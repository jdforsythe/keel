import type { Program } from "oxc-parser";
import type { AstNode } from "./AstNode.ts";
import type { RefLink } from "./RefLink.ts";
import type { TopRef } from "./TopRef.ts";
import { isAstNode } from "./isAstNode.ts";

type Scope = { readonly names: ReadonlySet<string>; readonly parent: Scope | null };

/** Fields that hold types, never values. */
const TYPE_FIELDS = new Set(["typeAnnotation", "returnType", "typeParameters", "typeArguments", "superTypeArguments"]);
/** TypeScript nodes that hold a value expression in `expression`. */
const TS_VALUE = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
  "TSExportAssignment",
]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

const memo = new WeakMap<Program, ReadonlyMap<string, readonly TopRef[]>>();

const field = (n: AstNode, key: string): AstNode | undefined => {
  const v = n[key];
  return isAstNode(v) ? v : undefined;
};
const list = (n: AstNode, key: string): AstNode[] => {
  const v = n[key];
  return Array.isArray(v) ? v.filter(isAstNode) : [];
};

/** The names a binding pattern declares. */
function patternNames(p: AstNode | undefined, out: Set<string>): void {
  if (p === undefined) return;
  if (p.type === "Identifier" && typeof p.name === "string") out.add(p.name);
  else if (p.type === "AssignmentPattern") patternNames(field(p, "left"), out);
  else if (p.type === "RestElement") patternNames(field(p, "argument"), out);
  else if (p.type === "TSParameterProperty") patternNames(field(p, "parameter"), out);
  else if (p.type === "ArrayPattern") for (const e of list(p, "elements")) patternNames(e, out);
  else if (p.type === "ObjectPattern")
    for (const q of list(p, "properties"))
      patternNames(q.type === "RestElement" ? field(q, "argument") : field(q, "value"), out);
}

/** The block-scoped names `statements` declare directly: `let`, `const`, classes, functions, enums, imports. */
function lexicalNames(statements: readonly AstNode[], out: Set<string>): void {
  for (const raw of statements) {
    const st =
      (raw.type === "ExportNamedDeclaration" || raw.type === "ExportDefaultDeclaration"
        ? field(raw, "declaration")
        : raw) ?? raw;
    if (st.type === "VariableDeclaration" && st.kind !== "var")
      for (const d of list(st, "declarations")) patternNames(field(d, "id"), out);
    if (
      st.type === "FunctionDeclaration" ||
      st.type === "ClassDeclaration" ||
      st.type === "TSEnumDeclaration" ||
      st.type === "TSModuleDeclaration" ||
      st.type === "TSImportEqualsDeclaration"
    )
      patternNames(field(st, "id"), out);
    if (st.type === "ImportDeclaration") for (const sp of list(st, "specifiers")) patternNames(field(sp, "local"), out);
  }
}

/** The `var` names under `n`, nested blocks included and nested functions not. */
function varNames(n: AstNode, out: Set<string>): void {
  if (n.type === "VariableDeclaration" && n.kind === "var")
    for (const d of list(n, "declarations")) patternNames(field(d, "id"), out);
  for (const [key, v] of Object.entries(n)) {
    if (TYPE_FIELDS.has(key)) continue;
    for (const c of Array.isArray(v) ? v : [v])
      if (isAstNode(c) && !FUNCTIONS.has(c.type) && c.type !== "ClassBody") varNames(c, out);
  }
}

/**
 * Every reference in `program` to a binding of its top level (an import, a top-level `const`, `let`, `var`, function
 * or class), resolved by lexical scope: a parameter, a local or a block's own binding of the same name shadows it.
 * Types are not references. An export specifier's local name, an assignment target and a shorthand property's value
 * are. Each reference carries its ancestors, so a reader can tell the use. Keyed by name, in source order.
 */
export function topRefs(program: Program): ReadonlyMap<string, readonly TopRef[]> {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const out = new Map<string, TopRef[]>();
  const links: RefLink[] = [];
  const root: AstNode = { type: "Program", start: program.start, end: program.end, body: program.body };
  const topNames = new Set<string>();
  lexicalNames(list(root, "body"), topNames);
  varNames(root, topNames);
  const top: Scope = { names: topNames, parent: null };

  const record = (ident: AstNode, name: string, scope: Scope): void => {
    let s: Scope | null = scope;
    while (s !== null && !s.names.has(name)) s = s.parent;
    if (s !== top) return;
    const refs = out.get(name) ?? [];
    refs.push({ ident, links: [...links] });
    out.set(name, refs);
  };
  const down = (parent: AstNode, key: string, child: AstNode | undefined, scope: Scope): void => {
    if (child === undefined) return;
    links.push({ node: parent, key });
    visit(child, scope);
    links.pop();
  };
  const downAll = (parent: AstNode, key: string, scope: Scope): void => {
    for (const c of list(parent, key)) down(parent, key, c, scope);
  };
  /** A binding pattern: its names are declarations; its defaults and computed keys are read. */
  const bind = (parent: AstNode, key: string, p: AstNode | undefined, scope: Scope): void => {
    if (p === undefined) return;
    links.push({ node: parent, key });
    if (p.type === "AssignmentPattern") {
      bind(p, "left", field(p, "left"), scope);
      down(p, "right", field(p, "right"), scope);
    } else if (p.type === "RestElement") bind(p, "argument", field(p, "argument"), scope);
    else if (p.type === "TSParameterProperty") bind(p, "parameter", field(p, "parameter"), scope);
    else if (p.type === "ArrayPattern") for (const e of list(p, "elements")) bind(p, "elements", e, scope);
    else if (p.type === "ObjectPattern")
      for (const q of list(p, "properties")) {
        if (q.type === "RestElement") bind(p, "properties", q, scope);
        else {
          links.push({ node: p, key: "properties" });
          if (q.computed === true) down(q, "key", field(q, "key"), scope);
          bind(q, "value", field(q, "value"), scope);
          links.pop();
        }
      }
    else if (p.type === "Identifier") for (const d of list(p, "decorators")) down(p, "decorators", d, scope);
    links.pop();
  };
  const fn = (n: AstNode, scope: Scope): void => {
    const names = new Set<string>();
    for (const p of list(n, "params")) patternNames(p, names);
    const id = field(n, "id");
    if (n.type === "FunctionExpression") patternNames(id, names);
    const body = field(n, "body");
    if (body !== undefined) {
      if (body.type === "BlockStatement" || body.type === "FunctionBody") lexicalNames(list(body, "body"), names);
      varNames(body, names);
    }
    const inner: Scope = { names, parent: scope };
    for (const p of list(n, "params")) bind(n, "params", p, inner);
    if (body !== undefined) {
      links.push({ node: n, key: "body" });
      if (body.type === "BlockStatement" || body.type === "FunctionBody") downAll(body, "body", inner);
      else visit(body, inner);
      links.pop();
    }
  };
  const block = (n: AstNode, key: string, scope: Scope): Scope => {
    const names = new Set<string>();
    lexicalNames(list(n, key), names);
    return { names, parent: scope };
  };
  const generic = (n: AstNode, scope: Scope): void => {
    for (const [key, v] of Object.entries(n)) {
      if (key === "type" || key === "start" || key === "end" || TYPE_FIELDS.has(key)) continue;
      if (Array.isArray(v)) downAll(n, key, scope);
      else if (isAstNode(v)) down(n, key, v, scope);
    }
  };

  function visit(n: AstNode, scope: Scope): void {
    switch (n.type) {
      case "Identifier":
        if (typeof n.name === "string") record(n, n.name, scope);
        return;
      case "JSXIdentifier": {
        const parent = links.at(-1);
        const name = typeof n.name === "string" ? n.name : "";
        const component = parent?.node.type === "JSXMemberExpression" || /^[A-Z_$]/.test(name);
        if (component && parent?.key !== "property" && parent?.node.type !== "JSXAttribute") record(n, name, scope);
        return;
      }
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        fn(n, scope);
        return;
      case "BlockStatement":
      case "StaticBlock":
      case "TSModuleBlock":
        downAll(n, "body", block(n, "body", scope));
        return;
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const names = new Set<string>();
        const head = field(n, n.type === "ForStatement" ? "init" : "left");
        if (head?.type === "VariableDeclaration" && head.kind !== "var")
          for (const d of list(head, "declarations")) patternNames(field(d, "id"), names);
        generic(n, { names, parent: scope });
        return;
      }
      case "SwitchStatement": {
        down(n, "discriminant", field(n, "discriminant"), scope);
        const names = new Set<string>();
        for (const c of list(n, "cases")) lexicalNames(list(c, "consequent"), names);
        downAll(n, "cases", { names, parent: scope });
        return;
      }
      case "CatchClause": {
        const names = new Set<string>();
        patternNames(field(n, "param"), names);
        const inner: Scope = { names, parent: scope };
        bind(n, "param", field(n, "param"), inner);
        down(n, "body", field(n, "body"), inner);
        return;
      }
      case "ClassDeclaration":
      case "ClassExpression": {
        const names = new Set<string>();
        if (n.type === "ClassExpression") patternNames(field(n, "id"), names);
        const inner: Scope = { names, parent: scope };
        downAll(n, "decorators", scope);
        down(n, "superClass", field(n, "superClass"), scope);
        down(n, "body", field(n, "body"), inner);
        return;
      }
      case "VariableDeclarator":
        bind(n, "id", field(n, "id"), scope);
        down(n, "init", field(n, "init"), scope);
        return;
      case "MemberExpression":
        down(n, "object", field(n, "object"), scope);
        if (n.computed === true) down(n, "property", field(n, "property"), scope);
        return;
      case "Property":
      case "MethodDefinition":
      case "PropertyDefinition":
      case "AccessorProperty":
      case "TSAbstractMethodDefinition":
      case "TSAbstractPropertyDefinition":
      case "TSAbstractAccessorProperty":
        downAll(n, "decorators", scope);
        if (n.computed === true) down(n, "key", field(n, "key"), scope);
        down(n, "value", field(n, "value"), scope);
        return;
      case "LabeledStatement":
        down(n, "body", field(n, "body"), scope);
        return;
      case "BreakStatement":
      case "ContinueStatement":
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "MetaProperty":
      case "JSXAttribute":
        if (n.type === "JSXAttribute") down(n, "value", field(n, "value"), scope);
        return;
      case "ExportNamedDeclaration":
        if (field(n, "declaration") !== undefined) down(n, "declaration", field(n, "declaration"), scope);
        else if (n.source === null || n.source === undefined)
          for (const sp of list(n, "specifiers")) {
            links.push({ node: n, key: "specifiers" });
            const local = field(sp, "local");
            const name = local === undefined ? undefined : local.type === "Literal" ? local.value : local.name;
            if (local !== undefined && typeof name === "string") {
              links.push({ node: sp, key: "local" });
              record(local, name, scope);
              links.pop();
            }
            links.pop();
          }
        return;
      case "TSImportEqualsDeclaration":
        down(n, "moduleReference", field(n, "moduleReference"), scope);
        return;
      case "TSQualifiedName":
        down(n, "left", field(n, "left"), scope);
        return;
      case "TSEnumDeclaration":
      case "TSEnumBody":
      case "TSEnumMember":
        if (n.type === "TSEnumMember") down(n, "initializer", field(n, "initializer"), scope);
        else generic(n, scope);
        return;
      case "TSModuleDeclaration":
        down(n, "body", field(n, "body"), scope);
        return;
      default:
        if (TS_VALUE.has(n.type)) down(n, "expression", field(n, "expression"), scope);
        else if (!n.type.startsWith("TS")) generic(n, scope);
    }
  }

  downAll(root, "body", top);
  memo.set(program, out);
  return out;
}
