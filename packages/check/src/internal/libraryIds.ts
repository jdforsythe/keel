import { Visitor } from "oxc-parser";
import type {
  BindingProperty,
  Expression,
  JSXAttributeItem,
  ObjectExpression,
  ParamPattern,
  Program,
  VariableDeclarator,
} from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { BASE_ELEMENTS } from "./BASE_ELEMENTS.ts";
import type { Checked } from "./Checked.ts";
import { keyName } from "./keyName.ts";
import { moduleDiag } from "./modules/moduleDiag.ts";

/** The packages whose elements E1161 judges, and the names it judges from each. */
const SOURCES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["@keel/ui", BASE_ELEMENTS],
  ["@keel/ui/aria", new Set(["Part"])],
]);

/** `x as T`, `x satisfies T`, `x!` and `(x)` read through. */
function unwrap(e: Expression): Expression {
  let x = e;
  while (
    x.type === "TSAsExpression" ||
    x.type === "TSSatisfiesExpression" ||
    x.type === "TSNonNullExpression" ||
    x.type === "ParenthesizedExpression"
  )
    x = x.expression;
  return x;
}

/** Whether a destructuring property reads the key `id`. */
const idKey = (p: BindingProperty): boolean =>
  !p.computed &&
  ((p.key.type === "Identifier" && p.key.name === "id") || (p.key.type === "Literal" && p.key.value === "id"));

/** The names a file binds to its components' `id` prop or to a value built from it (`idNames`). */
type Names = {
  readonly params: ReadonlySet<string>;
  readonly built: ReadonlySet<string>;
  /** Each `const` initialized with an object literal, by name. */
  readonly objects: ReadonlyMap<string, readonly ObjectExpression[]>;
};

/**
 * Whether `e` is built from a component's `id` prop: `<param>.id` (`<param>` a function's first parameter), a name bound
 * to one or to such a value, a template literal with such an expression, a call (its result is the function's, as
 * `partId(key)`), or a conditional whose two branches are.
 */
function built(e: Expression, names: Names): boolean {
  const x = unwrap(e);
  if (x.type === "Identifier") return names.built.has(x.name);
  if (x.type === "MemberExpression")
    return (
      !x.computed &&
      x.property.type === "Identifier" &&
      x.property.name === "id" &&
      x.object.type === "Identifier" &&
      names.params.has(x.object.name)
    );
  if (x.type === "TemplateLiteral") return x.expressions.some((y) => built(y, names));
  if (x.type === "CallExpression") return true;
  if (x.type === "ConditionalExpression") return built(x.consequent, names) && built(x.alternate, names);
  return false;
}

/**
 * The names of `program` (`Names`): each function's first parameter that is a name, and, to a fixed point, each `const`
 * bound to `<param>.id`, destructured as `id` from a parameter or in a parameter's pattern, or initialized with a value
 * `built` accepts. Read by name over the file.
 */
function idNames(program: Program): Names {
  const params = new Set<string>();
  const holders = new Set<string>();
  const decls: VariableDeclarator[] = [];
  const param = (p: ParamPattern | undefined): void => {
    if (p === undefined) return;
    const q = p.type === "AssignmentPattern" ? p.left : p;
    if (q.type === "Identifier") params.add(q.name);
    if (q.type === "ObjectPattern")
      for (const prop of q.properties)
        if (prop.type === "Property" && idKey(prop) && prop.value.type === "Identifier") holders.add(prop.value.name);
  };
  new Visitor({
    FunctionDeclaration: (f) => param(f.params[0]),
    FunctionExpression: (f) => param(f.params[0]),
    ArrowFunctionExpression: (f) => param(f.params[0]),
    VariableDeclarator: (d) => void decls.push(d),
  }).visit(program);
  const objects = new Map<string, ObjectExpression[]>();
  for (const d of decls) {
    const init = d.init === null || d.init === undefined ? undefined : unwrap(d.init);
    if (d.id.type === "Identifier" && init?.type === "ObjectExpression")
      objects.set(d.id.name, [...(objects.get(d.id.name) ?? []), init]);
  }
  const names = { params, built: holders, objects };
  for (let grew = true; grew; ) {
    grew = false;
    for (const d of decls) {
      const init = d.init === null || d.init === undefined ? undefined : unwrap(d.init);
      if (init === undefined) continue;
      const add = (n: string): void => {
        if (!holders.has(n)) {
          holders.add(n);
          grew = true;
        }
      };
      if (d.id.type === "Identifier" && built(init, names)) add(d.id.name);
      if (d.id.type === "ObjectPattern" && init.type === "Identifier" && params.has(init.name))
        for (const prop of d.id.properties)
          if (prop.type === "Property" && idKey(prop) && prop.value.type === "Identifier") add(prop.value.name);
    }
  }
  return names;
}

/**
 * The `id` a spread gives: an object literal's, inline or the one `const` of that name holds (`objectId`), else `null`
 * (check cannot read what it holds, so it may set or replace an `id`).
 */
function spreadId(arg: Expression, names: Names, depth: number): Expression | null | undefined {
  const x = unwrap(arg);
  const objs = x.type === "Identifier" ? names.objects.get(x.name) : undefined;
  const o = x.type === "ObjectExpression" ? x : objs?.length === 1 ? objs[0] : undefined;
  return o === undefined || depth > 4 ? null : objectId(o, names, depth + 1);
}

/** The `id` an object literal gives after its properties in order: undefined for none, `null` for one check cannot read. */
function objectId(o: ObjectExpression, names: Names, depth = 0): Expression | null | undefined {
  let id: Expression | null | undefined;
  for (const p of o.properties) {
    if (p.type === "Property") {
      if (keyName(p) === "id") id = p.value;
    } else {
      const inner = spreadId(p.argument, names, depth);
      if (inner !== undefined) id = inner;
    }
  }
  return id;
}

/** Whether JSX attributes fail E1161: no `id` check can read after the last spread, or one not `built`. */
function jsxBad(attributes: readonly JSXAttributeItem[], names: Names): boolean {
  let id: Expression | null | undefined;
  for (const a of attributes) {
    if (a.type === "JSXSpreadAttribute") {
      const inner = spreadId(a.argument, names, 0);
      if (inner !== undefined) id = inner;
    } else if (a.name.type === "JSXIdentifier" && a.name.name === "id") {
      const v = a.value;
      id =
        v !== null && v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
          ? v.expression
          : null;
    }
  }
  return id === null || id === undefined || !built(id, names);
}

/** The same for the object a call passes. */
function objectBad(o: ObjectExpression, names: Names): boolean {
  const id = objectId(o, names);
  return id === null || id === undefined || !built(id, names);
}

/**
 * E1161 (k.library Ids): in each library file (`isLibrary`), each element of `@keel/ui`'s base elements (`Host` among
 * them) and `@keel/ui/aria`'s `Part`, rendered as JSX or called, whose `id` check cannot show is `built` from its
 * component's `id` prop: none, one a later spread may replace, a call whose argument is no object literal, or any other
 * value (a literal, a concatenation, a template without the prop); aliases and namespace imports followed. At the
 * element's name; no fix.
 */
export function libraryIds(checked: readonly Checked[], isLibrary: (path: string) => boolean): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { file, parsed } of checked) {
    if (!isLibrary(file.path)) continue;
    const locals = new Map<string, string>();
    const spaces = new Map<string, ReadonlySet<string>>();
    for (const st of parsed.program.body) {
      if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
      const names = SOURCES.get(st.source.value);
      if (names === undefined) continue;
      for (const sp of st.specifiers) {
        if (sp.type === "ImportNamespaceSpecifier") spaces.set(sp.local.name, names);
        else if (sp.type === "ImportSpecifier" && sp.importKind !== "type") {
          const imported = sp.imported.type === "Identifier" ? sp.imported.name : String(sp.imported.value);
          if (names.has(imported)) locals.set(sp.local.name, imported);
        }
      }
    }
    if (locals.size === 0 && spaces.size === 0) continue;
    const names = idNames(parsed.program);
    const member = (o: string, p: string): string | undefined => (spaces.get(o)?.has(p) === true ? p : undefined);
    const report = (name: string, at: number): void =>
      void out.push(
        moduleDiag("E1161", file, at, `<${name}> in a library takes an id built from props.id`, undefined, "k.library"),
      );
    new Visitor({
      JSXOpeningElement: (o) => {
        const n = o.name;
        const name =
          n.type === "JSXIdentifier"
            ? locals.get(n.name)
            : n.type === "JSXMemberExpression" && n.object.type === "JSXIdentifier"
              ? member(n.object.name, n.property.name)
              : undefined;
        if (name !== undefined && jsxBad(o.attributes, names)) report(name, n.start);
      },
      CallExpression: (n) => {
        const c = n.callee;
        const name =
          c.type === "Identifier"
            ? locals.get(c.name)
            : c.type === "MemberExpression" &&
                !c.computed &&
                c.object.type === "Identifier" &&
                c.property.type === "Identifier"
              ? member(c.object.name, c.property.name)
              : undefined;
        if (name === undefined) return;
        const arg = n.arguments[0];
        if (arg === undefined || arg.type !== "ObjectExpression" || objectBad(arg, names)) report(name, c.start);
      },
    }).visit(parsed.program);
  }
  return out;
}
