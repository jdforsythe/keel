import { unwrapExpression } from "@keel/compiler/internal";
import { type Expression, type Program, Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import { bindingCalls } from "./bindingCalls.ts";
import { diagAt } from "./diagAt.ts";
import { importedFunction } from "./importedFunction.ts";
import { isAppPath } from "./isAppPath.ts";
import { moduleContracts } from "./moduleContracts.ts";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";
import { propertyOf } from "./propertyOf.ts";
import { reachedFunctions } from "./reachedFunctions.ts";

const SERVER_FILE = /^modules\/([^/]+)\/(?:.+\/)?[^/]+\.server\.tsx?$/;
const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);
const MAX_DEPTH = 8;

/** A function of a project file: its file, parse and span. */
type Fn = { readonly file: SourceFile; readonly program: Program; readonly start: number; readonly end: number };
/** A page or layout loader naming a readable factory: its route id, where its `stores` value starts, the factory. */
type Use = {
  readonly route: string;
  readonly file: SourceFile;
  readonly at: number;
  readonly name: string;
  readonly fn: Fn;
};

/** Names a call's callee binds to `exported` of `source`: a named import, or a member of a namespace import. */
function callsOf(program: Program, exported: string, source: string): (callee: Expression) => boolean {
  const names = localNames(program, exported, source);
  const spaces = namespaceNames(program, source);
  return (c) =>
    (c.type === "Identifier" && names.has(c.name)) ||
    (c.type === "MemberExpression" &&
      !c.computed &&
      c.object.type === "Identifier" &&
      spaces.has(c.object.name) &&
      c.property.name === exported);
}

/** The top-level function `name` of `program`, a function declaration or a `const` function, or an import of one. */
function factoryOf(file: SourceFile, program: Program, name: string, project: readonly SourceFile[]): Fn | null {
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
    if (d?.type === "FunctionDeclaration" && d.id?.name === name) return { file, program, start: d.start, end: d.end };
    if (d?.type === "VariableDeclaration" && d.kind === "const")
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.id.name === name && v.init !== null && v.init !== undefined) {
          const init = unwrapExpression(v.init);
          return FUNCTIONS.has(init.type) ? { file, program, start: init.start, end: init.end } : null;
        }
  }
  return importedFunction(program, file.path, name, project);
}

/**
 * The literal `id` of each `store` call of `@keel/store` in `fn` and in each function it calls: of its file
 * (`reachedFunctions`) or imported from a project file (`importedFunction`), to `MAX_DEPTH` imports.
 */
function idsOf(fn: Fn, project: readonly SourceFile[], seen: Set<string>, depth = 0): Set<string> {
  const out = new Set<string>();
  const key = `${fn.file.path}:${fn.start}`;
  if (seen.has(key) || depth > MAX_DEPTH) return out;
  seen.add(key);
  const spans = reachedFunctions(fn.program, fn);
  const inside = (at: number): boolean => spans.some((s) => at >= s.start && at < s.end);
  const isStore = callsOf(fn.program, "store", "@keel/store");
  const imported = new Set<string>();
  for (const st of fn.program.body)
    if (st.type === "ImportDeclaration" && st.source.value.startsWith("."))
      for (const sp of st.specifiers) imported.add(sp.local.name);
  new Visitor({
    CallExpression: (call) => {
      if (!inside(call.start)) return;
      const callee = unwrapExpression(call.callee);
      if (isStore(callee)) {
        const opts = call.arguments[2];
        const o = opts === undefined || opts.type === "SpreadElement" ? undefined : unwrapExpression(opts);
        const v = o?.type === "ObjectExpression" ? propertyOf(o, "id")?.value : undefined;
        if (v?.type === "Literal" && typeof v.value === "string") out.add(v.value);
        return;
      }
      if (callee.type !== "Identifier" || !imported.has(callee.name)) return;
      const next = importedFunction(fn.program, fn.file.path, callee.name, project);
      if (next !== null) for (const id of idsOf(next, project, seen, depth + 1)) out.add(id);
    },
  }).visit(fn.program);
  return out;
}

/** Each page or layout `loader(contract, id, decl, fn)` of `@keel/router` in a server file whose `decl` names a readable factory. */
function usesOf({ file, parsed }: Checked, project: readonly SourceFile[]): Use[] {
  const { program } = parsed;
  const isLoader = callsOf(program, "loader", "@keel/router");
  const out: Use[] = [];
  new Visitor({
    CallExpression: (call) => {
      if (!isLoader(unwrapExpression(call.callee))) return;
      const [, id, decl] = call.arguments;
      if (id?.type !== "Literal" || typeof id.value !== "string" || decl === undefined || decl.type === "SpreadElement")
        return;
      const d = unwrapExpression(decl);
      const v = d.type === "ObjectExpression" ? propertyOf(d, "stores")?.value : undefined;
      const name = v === undefined ? undefined : unwrapExpression(v);
      if (name?.type !== "Identifier") return;
      const fn = factoryOf(file, program, name.name, project);
      if (fn !== null) out.push({ route: id.value, file, at: name.start, name: name.name, fn });
    },
  }).visit(program);
  return out;
}

/**
 * E1550 (k.server Rules): two `stores` factories the loaders of one route chain name that create one store id, at the
 * deeper loader's `stores` value, naming both factories, the id and the other route. A factory is read as E1558 reads a
 * loader `fn`: the name of a top-level function or `const` function of the file, or of an import of one; its ids are
 * the literal `id` of each `store` call in it and in each function it calls (`idsOf`); one it cannot read is not judged.
 * A chain follows each binding's literal `layout` (`manifest` in the project); a page no binding names is read as under
 * each layout of its module's contract. `dirs` are the project roots (`projectDirs`), deepest first.
 */
export function chainStoreIds(
  files: readonly Checked[],
  dirs: readonly string[],
  project: readonly SourceFile[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const dirOf = (path: string): string => dirs.find((d) => path.startsWith(d)) ?? "";
  for (const dir of new Set(files.map((c) => dirOf(c.file.path)))) {
    const mine = files.filter((c) => dirOf(c.file.path) === dir && isAppPath(c.file.path));
    const uses = mine.filter((c) => SERVER_FILE.test(c.file.path.slice(dir.length))).flatMap((c) => usesOf(c, project));
    if (uses.length < 2) continue;
    const kinds = new Map<string, string>();
    const layoutsOf = new Map<string, string[]>();
    for (const mc of moduleContracts(mine))
      for (const e of mc.contract.list) {
        kinds.set(e.id, e.kind);
        if (e.kind === "layout") layoutsOf.set(mc.module, [...(layoutsOf.get(mc.module) ?? []), e.id]);
      }
    const parents = new Map<string, readonly string[]>();
    for (const c of mine)
      for (const call of bindingCalls(c.file, c.parsed.program))
        for (const { id, obj } of call.list) {
          const v = obj === null ? undefined : propertyOf(obj, "layout")?.value;
          parents.set(id, v?.type === "Literal" && typeof v.value === "string" ? [v.value] : []);
        }
    const up = (id: string): readonly string[] =>
      parents.get(id) ??
      (kinds.get(id) === "page" ? (layoutsOf.get(id.slice(0, Math.max(0, id.indexOf(".")))) ?? []) : []);
    const ids = new Map<string, ReadonlySet<string>>();
    const idsFor = (u: Use): ReadonlySet<string> => {
      const key = `${u.fn.file.path}:${u.fn.start}`;
      const known = ids.get(key) ?? idsOf(u.fn, project, new Set());
      ids.set(key, known);
      return known;
    };
    for (const deep of uses) {
      const above = new Set<string>();
      const todo = [...up(deep.route)];
      for (let r = todo.pop(); r !== undefined; r = todo.pop()) {
        if (above.has(r) || r === deep.route) continue;
        above.add(r);
        todo.push(...up(r));
      }
      for (const route of [...above].sort()) {
        const other = uses.find(
          (u) =>
            u.route === route &&
            `${u.fn.file.path}:${u.fn.start}` !== `${deep.fn.file.path}:${deep.fn.start}` &&
            [...idsFor(u)].some((id) => idsFor(deep).has(id)),
        );
        if (other === undefined) continue;
        const shared = [...idsFor(other)].filter((id) => idsFor(deep).has(id)).sort()[0] ?? "";
        const message = `stores: ${deep.name} and ${other.name} (${route}) both create store ${shared}; name one factory`;
        out.push(diagAt(deep.file, deep.at, "E1550", message, "k.server"));
      }
    }
  }
  return out;
}
