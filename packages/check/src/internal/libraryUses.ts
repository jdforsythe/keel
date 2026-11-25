import { type Argument, type CallExpression, type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { FileOf } from "./functionRead/FileOf.ts";
import { READ_DEPTH } from "./functionRead/READ_DEPTH.ts";
import type { ReadFn } from "./functionRead/ReadFn.ts";
import { exportedFunction } from "./functionRead/exportedFunction.ts";
import { localFunction } from "./functionRead/localFunction.ts";
import { parseFile } from "./parseFile.ts";

/** A use of a library export whose `register` name is its parameter: a call (judged by `arg`) or a use as a value. */
type Use =
  | { readonly kind: "call"; readonly call: CallExpression; readonly name: string; readonly arg: Argument | undefined }
  | { readonly kind: "value"; readonly at: number; readonly name: string };

/** A node of the tree, as the walk sees it. */
type Node = { readonly type: string; readonly start: number; readonly end: number };
/** The export a local name stands for: its name and the index of the parameter its `register` takes the name from. */
type Held = { readonly name: string; readonly index: number };

const isNode = (x: unknown): x is Node =>
  typeof x === "object" &&
  x !== null &&
  typeof Reflect.get(x, "type") === "string" &&
  typeof Reflect.get(x, "start") === "number";
const field = (n: Node | undefined, k: string): unknown => (n === undefined ? undefined : Reflect.get(n, k));
const nameOf = (n: unknown): string | undefined =>
  isNode(n) && n.type === "Identifier" ? String(field(n, "name")) : undefined;
/** The nodes types a name in a type position sits under. */
const TYPES = new Set([
  "TSTypeQuery",
  "TSTypeReference",
  "TSTypeAnnotation",
  "TSQualifiedName",
  "TSTypeParameterInstantiation",
]);
const fnKey = (path: string, fn: ReadFn): string => `${path}:${fn.start}`;

/** Each node of `root` with its parent, the parent's key holding it, and its ancestors, depth first in source order. */
function walk(
  root: unknown,
  visit: (n: Node, parent: Node | undefined, key: string, up: readonly Node[]) => void,
): void {
  const up: Node[] = [];
  const go = (x: unknown, parent: Node | undefined, key: string): void => {
    if (Array.isArray(x)) {
      for (const el of x) go(el, parent, key);
      return;
    }
    if (!isNode(x)) return;
    visit(x, parent, key, up);
    up.push(x);
    for (const k of Object.keys(x)) if (k !== "type" && k !== "start" && k !== "end") go(Reflect.get(x, k), x, k);
    up.pop();
  };
  go(root, undefined, "");
}

/** The names `program` exports as `const` declarations, and the locals its `export { x }` and `export default x` name. */
function exportedLocals(program: Program): Set<string> {
  const out = new Set<string>();
  for (const st of program.body) {
    if (st.type === "ExportNamedDeclaration" && st.source === null) {
      if (st.declaration?.type === "VariableDeclaration")
        for (const v of st.declaration.declarations) if (v.id.type === "Identifier") out.add(v.id.name);
      for (const sp of st.specifiers) if (sp.local.type === "Identifier") out.add(sp.local.name);
    }
    if (st.type === "ExportDefaultDeclaration" && st.declaration.type === "Identifier") out.add(st.declaration.name);
  }
  return out;
}

/** The export names of `file`, `export *` followed through the files `fileOf` finds, at most `READ_DEPTH` deep. */
function exportNamesIn(file: SourceFile, fileOf: FileOf, hops = 0): string[] {
  if (hops > READ_DEPTH) return [];
  const out: string[] = [];
  for (const st of parseFile(file).program.body) {
    if (st.type === "ExportDefaultDeclaration") out.push("default");
    if (st.type === "ExportAllDeclaration" && st.exported === null) {
      const next = fileOf(file, st.source.value);
      if (next !== undefined) out.push(...exportNamesIn(next, fileOf, hops + 1));
    }
    if (st.type !== "ExportNamedDeclaration") continue;
    for (const sp of st.specifiers) out.push(sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value);
    const d = st.declaration;
    if (d?.type === "FunctionDeclaration" && d.id !== null && d.id !== undefined) out.push(d.id.name);
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier") out.push(v.id.name);
  }
  return out;
}

/** `(x)` read through. */
function bare(n: unknown): unknown {
  let x = n;
  while (isNode(x) && x.type === "ParenthesizedExpression") x = field(x, "expression");
  return x;
}

/** The literal specifier of `import('<spec>')` (a string or a template without an expression), else undefined. */
function importSpec(n: Node): string | undefined {
  const src = field(n, "source");
  if (!isNode(src)) return undefined;
  const v = field(src, "value");
  if (src.type === "Literal" && typeof v === "string") return v;
  const quasis = field(src, "quasis");
  const exprs = field(src, "expressions");
  if (src.type !== "TemplateLiteral" || !Array.isArray(exprs) || exprs.length > 0 || !Array.isArray(quasis))
    return undefined;
  const cooked: unknown = Reflect.get(Object(Reflect.get(Object(quasis[0]), "value")), "cooked");
  return typeof cooked === "string" ? cooked : undefined;
}

/**
 * The uses in `checked` of a library export whose `register` name is its parameter (`params`, by `fnKey`; k.server-deps
 * Registration through a library), followed as the function read follows them (at most `READ_DEPTH` files deep): an
 * import of it by name or as the default, from the library or through project files that re-export it (`export { x }`,
 * renamed, `export *`, `export default x`); its own declaration in the file; a `const` alias of such a name; a static
 * member of a namespace (`import * as`, `import x = require(...)`, or a directly awaited `import('<spec>')`); and a
 * `const` destructuring of such a namespace by plain keys. A call of one is a `call`. Any other use is a `value` at the
 * use: an argument, an element or property value, a member of it (`.call`, `.apply`, `.bind`), a `let` or exported
 * alias, a computed member or rest of a namespace whose exports hold one, the namespace as a value, and an `import()`
 * that is not such a member call or destructuring (a non-literal `import(x)` among them). A name in a type position is
 * no use.
 */
export function libraryUses(checked: Checked, fileOf: FileOf, params: ReadonlyMap<string, number>): Use[] {
  const program = checked.parsed.program;
  const held = new Map<string, Held>();
  const followed = new Set<string>();
  const spaces = new Map<string, SourceFile>();
  const spaceFn = (entry: SourceFile, prop: string): Held | undefined => {
    const fn = exportedFunction(prop, entry, fileOf);
    const index = fn === undefined ? undefined : params.get(fnKey(fn.file.path, fn.fn));
    return index === undefined ? undefined : { name: prop, index };
  };
  const registersCache = new Map<string, boolean>();
  const registers = (entry: SourceFile): boolean => {
    const known = registersCache.get(entry.path);
    if (known !== undefined) return known;
    const hit = exportNamesIn(entry, fileOf).some((n) => spaceFn(entry, n) !== undefined);
    registersCache.set(entry.path, hit);
    return hit;
  };
  const hold = (local: string, h: Held): void => {
    held.set(local, h);
    followed.add(local);
  };
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (
      d?.type === "FunctionDeclaration" &&
      d.id !== null &&
      d.id !== undefined &&
      params.has(fnKey(checked.file.path, d))
    )
      hold(d.id.name, { name: d.id.name, index: params.get(fnKey(checked.file.path, d)) ?? 0 });
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) {
        const init = bare(v.init);
        const id = nameOf(v.id);
        if (!isNode(init) || id === undefined) continue;
        const index = params.get(`${checked.file.path}:${init.start}`);
        if (index !== undefined && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression"))
          hold(id, { name: id, index });
      }
    if (st.type === "TSImportEqualsDeclaration" && st.moduleReference.type === "TSExternalModuleReference") {
      const entry = fileOf(checked.file, st.moduleReference.expression.value);
      if (entry !== undefined) spaces.set(st.id.name, entry);
    }
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") {
        const entry = fileOf(checked.file, st.source.value);
        if (entry !== undefined) spaces.set(sp.local.name, entry);
        continue;
      }
      if (sp.type === "ImportSpecifier" && sp.importKind === "type") continue;
      const found = localFunction(sp.local.name, checked.file, fileOf);
      const index = found === undefined ? undefined : params.get(fnKey(found.file.path, found.fn));
      if (index !== undefined) hold(sp.local.name, { name: sp.local.name, index });
    }
  }
  for (const [local, entry] of [...spaces]) if (!registers(entry)) spaces.delete(local);
  if (held.size === 0 && spaces.size === 0 && !checked.file.source.includes("import(")) return [];
  const exported = exportedLocals(program);
  /** The namespace a destructuring's `init` reads: a namespace import, or a directly awaited literal `import()`. */
  const spaceOf = (init: unknown): SourceFile | undefined => {
    const x = bare(init);
    const named = nameOf(x);
    if (named !== undefined) return spaces.get(named);
    const arg = isNode(x) && x.type === "AwaitExpression" ? bare(field(x, "argument")) : undefined;
    const spec = isNode(arg) && arg.type === "ImportExpression" ? importSpec(arg) : undefined;
    const entry = spec === undefined ? undefined : fileOf(checked.file, spec);
    return entry !== undefined && registers(entry) ? entry : undefined;
  };
  // `const alias = name` and `const { key: local } = namespace`, to a fixed point.
  for (let grew = true; grew; ) {
    grew = false;
    new Visitor({
      VariableDeclaration: (d) => {
        if (d.kind !== "const") return;
        for (const v of d.declarations) {
          const to = nameOf(v.id);
          const from = nameOf(v.init);
          const h = from === undefined ? undefined : held.get(from);
          if (h !== undefined && to !== undefined && !held.has(to) && !exported.has(to)) {
            held.set(to, h);
            grew = true;
          }
          const entry = v.id.type === "ObjectPattern" ? spaceOf(v.init) : undefined;
          if (entry === undefined || v.id.type !== "ObjectPattern") continue;
          for (const p of v.id.properties) {
            const key = p.type === "Property" && !p.computed ? nameOf(p.key) : undefined;
            const local = p.type === "Property" ? nameOf(p.value) : undefined;
            const fn = key === undefined ? undefined : spaceFn(entry, key);
            if (fn === undefined || local === undefined || held.has(local) || exported.has(local)) continue;
            held.set(local, fn);
            grew = true;
          }
        }
      },
    }).visit(program);
  }
  const out: Use[] = [];
  const value = (at: number, name: string): void => void out.push({ kind: "value", at, name });
  /** A destructuring of namespace `entry`: each property that holds a registering export and is not followed. */
  const pattern = (pat: unknown, entry: SourceFile, name: string): void => {
    const props = field(isNode(pat) ? pat : undefined, "properties");
    for (const p of Array.isArray(props) ? props : []) {
      if (!isNode(p)) continue;
      if (p.type === "RestElement" || field(p, "computed") === true) {
        value(p.start, name);
        continue;
      }
      const key = nameOf(field(p, "key"));
      const fn = key === undefined ? undefined : spaceFn(entry, key);
      const local = held.get(nameOf(field(p, "value")) ?? "");
      if (fn !== undefined && (local?.name !== fn.name || local.index !== fn.index)) value(p.start, fn.name);
    }
  };
  /** A namespace read at `node` (parent `parent`, ancestors `up`): a followed member call, a destructuring, or a value. */
  const spaceUse = (
    node: Node,
    parent: Node,
    key: string,
    up: readonly Node[],
    entry: SourceFile,
    name: string,
  ): void => {
    if (parent.type === "VariableDeclarator" && key === "init" && isNode(field(parent, "id"))) {
      const id = field(parent, "id");
      if (isNode(id) && id.type === "ObjectPattern") {
        pattern(id, entry, name);
        return;
      }
    }
    const prop =
      parent.type === "MemberExpression" && key === "object" && field(parent, "computed") !== true
        ? nameOf(field(parent, "property"))
        : undefined;
    if (prop === undefined) {
      value(node.start, name);
      return;
    }
    const fn = spaceFn(entry, prop);
    if (fn === undefined) return;
    const call = up[up.length - 2];
    if (call !== undefined && isCall(call) && call.callee.start === parent.start && call.callee.end === parent.end)
      return void out.push({ kind: "call", call, name: prop, arg: call.arguments[fn.index] });
    value(parent.start, prop);
  };
  walk(program.body, (n, parent, key, up) => {
    if (parent === undefined || up.some((a) => TYPES.has(a.type))) return;
    if (n.type === "ImportExpression") {
      const spec = importSpec(n);
      if (spec === undefined) return value(n.start, "import()");
      const entry = fileOf(checked.file, spec);
      if (entry === undefined || !registers(entry)) return;
      // `(await import('<spec>'))`: the awaited, parenthesized expression stands where a namespace name would.
      let at = up.length - 1;
      if (up[at]?.type !== "AwaitExpression") return value(n.start, "import()");
      let node = up[at];
      at -= 1;
      while (up[at]?.type === "ParenthesizedExpression") {
        node = up[at];
        at -= 1;
      }
      const host = up[at];
      if (node === undefined || host === undefined) return value(n.start, "import()");
      const hostKey = host.type === "MemberExpression" ? "object" : host.type === "VariableDeclarator" ? "init" : "";
      if (field(host, hostKey) !== node) return value(n.start, "import()");
      return spaceUse(node, host, hostKey, up.slice(0, at + 1), entry, "import()");
    }
    const name = nameOf(n);
    if (name === undefined) return;
    const h = held.get(name);
    const space = spaces.get(name);
    if (h === undefined && space === undefined) return;
    const t = parent.type;
    if (t === "ImportSpecifier" || t === "ImportDefaultSpecifier" || t === "ImportNamespaceSpecifier") return;
    if (t === "TSImportEqualsDeclaration") return;
    if (
      (t === "MemberExpression" && key === "property" && field(parent, "computed") !== true) ||
      (t === "Property" && key === "key" && field(parent, "computed") !== true)
    )
      return;
    if ((t === "VariableDeclarator" && key === "id") || (t === "ExportSpecifier" && key === "exported")) return;
    if (
      (t === "FunctionDeclaration" || t === "FunctionExpression" || t === "ArrowFunctionExpression") &&
      key !== "body"
    )
      return;
    if (h !== undefined) {
      if (t === "Property" && key === "value" && up.some((a) => a.type === "ObjectPattern")) return;
      if ((t === "ExportSpecifier" && key === "local") || (t === "ExportDefaultDeclaration" && key === "declaration"))
        return void (followed.has(name) ? undefined : value(n.start, h.name));
      if (t === "VariableDeclarator" && key === "init" && held.get(nameOf(field(parent, "id")) ?? "") === h) return;
      if (t === "CallExpression" && key === "callee" && isCall(parent))
        return void out.push({ kind: "call", call: parent, name: h.name, arg: parent.arguments[h.index] });
      return value(n.start, h.name);
    }
    if (space !== undefined) spaceUse(n, parent, key, up, space, name);
  });
  return out;
}

/** Whether a node is a call expression. */
function isCall(n: Node): n is CallExpression {
  return n.type === "CallExpression";
}
