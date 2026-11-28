import type { Program } from "oxc-parser";
import type { HandlerKind } from "./HandlerKind.ts";
import type { HandlerOrigin } from "./HandlerOrigin.ts";
import type { HandlerUse } from "./HandlerUse.ts";

type Node = { readonly type: string; readonly start: number };
type Handlers = ReadonlyMap<string, HandlerKind>;

const isNode = (v: unknown): v is Node =>
  typeof v === "object" &&
  v !== null &&
  typeof Reflect.get(v, "type") === "string" &&
  typeof Reflect.get(v, "start") === "number";
const child = (n: Node, key: string): Node | undefined => {
  const v: unknown = Reflect.get(n, key);
  return isNode(v) ? v : undefined;
};
const children = (n: Node, key: string): Node[] => {
  const v: unknown = Reflect.get(n, key);
  return Array.isArray(v) ? v.filter(isNode) : [];
};
const text = (n: Node | undefined, key: string): string | undefined => {
  const v: unknown = n === undefined ? undefined : Reflect.get(n, key);
  return typeof v === "string" ? v : undefined;
};
/** A literal string: a string `Literal` or a template with no expressions. */
const literal = (n: Node | undefined): string | undefined => {
  if (n?.type === "Literal") return text(n, "value");
  if (n?.type !== "TemplateLiteral" || children(n, "expressions").length > 0) return undefined;
  const value: unknown = Reflect.get(children(n, "quasis")[0] ?? {}, "value");
  const cooked: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "cooked") : undefined;
  return typeof cooked === "string" ? cooked : undefined;
};
/** A property's key name: an identifier's or a literal's when not computed, a literal string's when it is. */
const keyName = (n: Node): string | undefined => {
  const key = child(n, "key");
  if (Reflect.get(n, "computed") === true) return literal(key);
  return key?.type === "Identifier" ? text(key, "name") : literal(key);
};
const unwrap = (n: Node | undefined): Node | undefined =>
  n?.type === "ParenthesizedExpression" || n?.type === "AwaitExpression" || n?.type === "ChainExpression"
    ? unwrap(child(n, "expression") ?? child(n, "argument"))
    : n;
/** TS nodes that hold a value expression: only that expression is walked. Every other `TS*` node is a type. */
const TS_VALUE = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion"]);
const TS_CODE = new Set(["TSModuleDeclaration", "TSModuleBlock", "TSExportAssignment", "TSInstantiationExpression"]);
const all = (handlers: Handlers): ReadonlySet<HandlerKind> => new Set(handlers.values());

/**
 * The uses of `@keel/router`'s handlers in one file (k.bundle Handlers), and the handlers it exports by name, given what
 * each module specifier exports (`origin`). A handler is known by binding: a named import (`as` or not), a namespace
 * import's or a dynamic `import()`'s member read by a literal name (`R.loader`, `R['loader']`, `const { loader } = R`),
 * or a re-export (`export { loader } from`, `export *`). A use is any read of such a binding as a value: a call, an
 * argument, an assignment, a destructuring, a re-export. A namespace object read other than by a literal member uses
 * every handler it holds. Type-only imports and type positions are none.
 */
export function handlerUses(
  program: Program,
  origin: HandlerOrigin,
): { readonly uses: readonly HandlerUse[]; readonly exports: Handlers } {
  const direct = new Map<string, HandlerKind>();
  const spaces = new Map<string, Handlers>();
  const uses: HandlerUse[] = [];
  const exports = new Map<string, HandlerKind>();
  const use = (start: number, kinds: ReadonlySet<HandlerKind>): void => {
    if (kinds.size > 0) uses.push({ start, kinds });
  };
  const sourceOf = (n: Node): Handlers | undefined => {
    const s = literal(child(n, "source"));
    return s === undefined ? undefined : origin(s);
  };
  /** The handlers a namespace value holds: a namespace import's local, or a literal `import()` of an origin. */
  const space = (n: Node | undefined): Handlers | undefined => {
    const u = unwrap(n);
    if (u?.type === "Identifier") return spaces.get(text(u, "name") ?? "");
    return u?.type === "ImportExpression" ? sourceOf(u) : undefined;
  };
  const body = children(program, "body");
  for (const s of body) {
    if (s.type !== "ImportDeclaration" || text(s, "importKind") === "type") continue;
    const from = sourceOf(s);
    if (from === undefined) continue;
    for (const sp of children(s, "specifiers")) {
      const local = text(child(sp, "local"), "name") ?? "";
      if (sp.type === "ImportNamespaceSpecifier") spaces.set(local, from);
      if (sp.type !== "ImportSpecifier" || text(sp, "importKind") === "type") continue;
      const imported = child(sp, "imported");
      const kind = from.get((imported?.type === "Identifier" ? text(imported, "name") : literal(imported)) ?? "");
      if (kind !== undefined) direct.set(local, kind);
    }
  }
  // `const R = await import('@keel/router')` binds a namespace as an import does.
  const declared = (n: Node): void => {
    if (n.type === "VariableDeclarator" && child(n, "id")?.type === "Identifier") {
      const init = unwrap(child(n, "init"));
      const from = init?.type === "ImportExpression" ? sourceOf(init) : undefined;
      if (from !== undefined) spaces.set(text(child(n, "id"), "name") ?? "", from);
    }
    for (const k of Object.keys(n)) for (const c of [child(n, k), ...children(n, k)]) if (c !== undefined) declared(c);
  };
  declared(program);

  /** A binding pattern: its names are not reads; its defaults and computed keys are. */
  const pattern = (n: Node | undefined): void => {
    if (n === undefined || n.type === "Identifier") return;
    if (n.type === "AssignmentPattern") {
      pattern(child(n, "left"));
      expr(child(n, "right"));
    } else if (n.type === "ObjectPattern")
      for (const p of children(n, "properties")) {
        if (p.type === "RestElement") pattern(child(p, "argument"));
        else {
          if (Reflect.get(p, "computed") === true) expr(child(p, "key"));
          pattern(child(p, "value"));
        }
      }
    else if (n.type === "ArrayPattern") for (const e of children(n, "elements")) pattern(e);
    else if (n.type === "RestElement") pattern(child(n, "argument"));
    else expr(n);
  };
  /** Literal keys destructured from a namespace: each a member read; a rest or a computed key reads them all. */
  const destructure = (id: Node, from: Handlers): void => {
    for (const p of children(id, "properties")) {
      const name = p.type === "Property" ? keyName(p) : undefined;
      if (name === undefined) use(p.start, all(from));
      else {
        const kind = from.get(name);
        use(p.start, new Set(kind === undefined ? [] : [kind]));
      }
      if (p.type === "Property") pattern(child(p, "value"));
    }
  };
  const fn = (n: Node): void => {
    for (const p of children(n, "params")) pattern(p);
    expr(child(n, "body"));
  };
  const expr = (n: Node | undefined): void => {
    if (n === undefined) return;
    const t = n.type;
    if (t.startsWith("TS") && !TS_CODE.has(t)) {
      if (TS_VALUE.has(t)) expr(child(n, "expression"));
      return;
    }
    if (t === "Identifier") {
      const name = text(n, "name") ?? "";
      const kind = direct.get(name);
      if (kind !== undefined) use(n.start, new Set([kind]));
      const ns = spaces.get(name);
      if (ns !== undefined) use(n.start, all(ns));
      return;
    }
    if (t === "ImportDeclaration") return;
    if (t === "ImportExpression") {
      const from = sourceOf(n);
      if (from !== undefined) use(n.start, all(from));
      else expr(child(n, "source"));
      return;
    }
    if (t === "MemberExpression") {
      const ns = space(child(n, "object"));
      const computed = Reflect.get(n, "computed") === true;
      const name = computed ? literal(child(n, "property")) : text(child(n, "property"), "name");
      if (ns !== undefined && name !== undefined) {
        const kind = ns.get(name);
        use(n.start, new Set(kind === undefined ? [] : [kind]));
        return;
      }
      expr(child(n, "object"));
      if (computed) expr(child(n, "property"));
      return;
    }
    if (t === "VariableDeclarator") {
      const id = child(n, "id");
      const init = child(n, "init");
      const ns = space(init);
      if (id?.type === "ObjectPattern" && ns !== undefined) {
        destructure(id, ns);
        return;
      }
      if (id?.type === "Identifier" && unwrap(init)?.type === "ImportExpression" && ns !== undefined) return;
      pattern(id);
      expr(init);
      return;
    }
    if (t === "Property" || t === "MethodDefinition" || t === "PropertyDefinition" || t === "AccessorProperty") {
      if (Reflect.get(n, "computed") === true) expr(child(n, "key"));
      expr(child(n, "value"));
      return;
    }
    if (t === "FunctionDeclaration" || t === "FunctionExpression" || t === "ArrowFunctionExpression") {
      fn(n);
      return;
    }
    if (t === "CatchClause") {
      pattern(child(n, "param"));
      expr(child(n, "body"));
      return;
    }
    if (t === "ClassDeclaration" || t === "ClassExpression") {
      expr(child(n, "superClass"));
      expr(child(n, "body"));
      return;
    }
    if (t === "LabeledStatement") {
      expr(child(n, "body"));
      return;
    }
    if (t === "BreakStatement" || t === "ContinueStatement" || t === "MetaProperty") return;
    if (t === "AssignmentExpression") {
      const left = child(n, "left");
      if (left?.type === "ObjectPattern" || left?.type === "ArrayPattern") pattern(left);
      else expr(left);
      expr(child(n, "right"));
      return;
    }
    if (t === "ForInStatement" || t === "ForOfStatement") {
      const left = child(n, "left");
      if (left?.type === "VariableDeclaration") for (const d of children(left, "declarations")) pattern(child(d, "id"));
      else pattern(left);
      expr(child(n, "right"));
      expr(child(n, "body"));
      return;
    }
    if (t === "ExportNamedDeclaration") {
      if (text(n, "exportKind") === "type") return;
      const from = sourceOf(n);
      const hasSource = child(n, "source") !== undefined;
      for (const sp of children(n, "specifiers")) {
        if (text(sp, "exportKind") === "type") continue;
        const local = child(sp, "local");
        const exported = child(sp, "exported");
        const name = (local?.type === "Identifier" ? text(local, "name") : literal(local)) ?? "";
        const as = (exported?.type === "Identifier" ? text(exported, "name") : literal(exported)) ?? name;
        const kind = hasSource ? from?.get(name) : direct.get(name);
        if (kind !== undefined) {
          exports.set(as, kind);
          use(sp.start, new Set([kind]));
        } else if (!hasSource && local !== undefined) expr(local);
      }
      expr(child(n, "declaration"));
      return;
    }
    if (t === "ExportAllDeclaration") {
      if (text(n, "exportKind") === "type") return;
      const from = sourceOf(n);
      if (from === undefined) return;
      if (child(n, "exported") === undefined) for (const [k, v] of from) exports.set(k, v);
      use(n.start, all(from));
      return;
    }
    for (const k of Object.keys(n)) {
      expr(child(n, k));
      for (const c of children(n, k)) expr(c);
    }
  };
  for (const s of body) expr(s);
  return { uses, exports };
}
