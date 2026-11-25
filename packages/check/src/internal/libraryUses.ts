import { type Argument, type CallExpression, type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { FileOf } from "./functionRead/FileOf.ts";
import type { ReadFn } from "./functionRead/ReadFn.ts";
import { exportedFunction } from "./functionRead/exportedFunction.ts";
import { localFunction } from "./functionRead/localFunction.ts";

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

/**
 * The uses in `checked` of a library export whose `register` name is its parameter (`params`, by `fnKey`; k.server-deps
 * Registration through a library), followed as the function read follows them: an import of it by name or as the
 * default (from the library or through a project file that re-exports it), a `const` alias of such a name in the file,
 * and a static member of a namespace import. A call of one is a `call`; a re-export by `export { x }` or `export
 * default x` of the imported name is followed where it is imported. Any other use is a `value` at the use: an alias that
 * is exported or not a plain `const`, an argument, an element or property value, a member such as `.call`, `.apply` or
 * `.bind`, a computed member of a namespace import, and the namespace itself as a value, when its library has such an
 * export (`libraryOf` gives the folder of a library's file). A name in a type position is no use.
 */
export function libraryUses(
  checked: Checked,
  fileOf: FileOf,
  params: ReadonlyMap<string, number>,
  libraryOf: (path: string) => string | undefined,
): Use[] {
  const program = checked.parsed.program;
  const held = new Map<string, Held>();
  const spaces = new Map<string, { readonly entry: SourceFile; readonly registers: boolean }>();
  const folders = new Set([...params.keys()].map((k) => libraryOf(k.slice(0, k.lastIndexOf(":")))));
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") {
        const entry = fileOf(checked.file, st.source.value);
        if (entry !== undefined) spaces.set(sp.local.name, { entry, registers: folders.has(libraryOf(entry.path)) });
        continue;
      }
      if (sp.type === "ImportSpecifier" && sp.importKind === "type") continue;
      const found = localFunction(sp.local.name, checked.file, fileOf);
      const index = found === undefined ? undefined : params.get(fnKey(found.file.path, found.fn));
      if (index !== undefined) held.set(sp.local.name, { name: sp.local.name, index });
    }
  }
  if (held.size === 0 && ![...spaces.values()].some((s) => s.registers)) return [];
  const exported = exportedLocals(program);
  const imported = new Set(held.keys());
  // `const alias = name`, to a fixed point: an alias of an alias stands for the same export.
  for (let grew = true; grew; ) {
    grew = false;
    new Visitor({
      VariableDeclaration: (d) => {
        if (d.kind !== "const") return;
        for (const v of d.declarations) {
          const from = nameOf(v.init);
          const to = nameOf(v.id);
          const h = from === undefined ? undefined : held.get(from);
          if (h === undefined || to === undefined || held.has(to) || exported.has(to)) continue;
          held.set(to, h);
          grew = true;
        }
      },
    }).visit(program);
  }
  const out: Use[] = [];
  const spaceFn = (entry: SourceFile, prop: string): Held | undefined => {
    const fn = exportedFunction(prop, entry, fileOf);
    const index = fn === undefined ? undefined : params.get(fnKey(fn.file.path, fn.fn));
    return index === undefined ? undefined : { name: prop, index };
  };
  walk(program.body, (n, parent, key, up) => {
    const name = nameOf(n);
    if (name === undefined || parent === undefined) return;
    const h = held.get(name);
    const space = spaces.get(name);
    if (h === undefined && space === undefined) return;
    if (up.some((a) => TYPES.has(a.type))) return;
    const t = parent.type;
    if (t === "ImportSpecifier" || t === "ImportDefaultSpecifier" || t === "ImportNamespaceSpecifier") return;
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
      if ((t === "ExportSpecifier" && key === "local") || (t === "ExportDefaultDeclaration" && key === "declaration"))
        return void (imported.has(name) ? undefined : out.push({ kind: "value", at: n.start, name: h.name }));
      if (t === "VariableDeclarator" && key === "init" && held.get(nameOf(field(parent, "id")) ?? "") === h) return;
      if (t === "CallExpression" && key === "callee" && isCall(parent))
        return void out.push({ kind: "call", call: parent, name: h.name, arg: parent.arguments[h.index] });
      return void out.push({ kind: "value", at: n.start, name: h.name });
    }
    if (space === undefined || !space.registers) return;
    const prop =
      t === "MemberExpression" && key === "object" && field(parent, "computed") !== true
        ? nameOf(field(parent, "property"))
        : undefined;
    if (prop === undefined) return void out.push({ kind: "value", at: n.start, name });
    const fn = spaceFn(space.entry, prop);
    if (fn === undefined) return;
    const call = up[up.length - 2];
    if (call !== undefined && isCall(call) && call.callee.start === parent.start && call.callee.end === parent.end)
      return void out.push({ kind: "call", call, name: prop, arg: call.arguments[fn.index] });
    out.push({ kind: "value", at: parent.start, name: prop });
  });
  return out;
}

/** Whether a node is a call expression. */
function isCall(n: Node): n is CallExpression {
  return n.type === "CallExpression";
}
