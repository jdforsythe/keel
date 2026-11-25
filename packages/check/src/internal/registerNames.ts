import { clipMessage } from "@keel/schema/internal";
import { type Argument, type CallExpression, Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { RegisterLibraries } from "./RegisterLibraries.ts";
import { diagAt } from "./diagAt.ts";
import type { ReadFn } from "./functionRead/ReadFn.ts";
import { exportedFunction } from "./functionRead/exportedFunction.ts";
import { fileOfIn } from "./functionRead/fileOfIn.ts";
import { localFunction } from "./functionRead/localFunction.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";

const LOWER_CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const MODULE_DIR = /^modules\/([^/]+)\//;

/** A name: where its diagnostic points, the literal value (none when it is not a string literal), and what names it. */
type Call = { readonly at: number; readonly name: string | undefined; readonly by: string };

/** The literal string of an argument, or undefined. */
const literal = (a: Argument | undefined): string | undefined =>
  a?.type === "Literal" && typeof a.value === "string" ? a.value : undefined;

/** The `register` calls of `@keel/ctx` in a file, in source order. */
function registerCalls({ parsed }: Checked): CallExpression[] {
  const direct = localNames(parsed.program, "register", "@keel/ctx");
  const spaces = namespaceNames(parsed.program, "@keel/ctx");
  if (direct.size === 0 && spaces.size === 0) return [];
  const out: CallExpression[] = [];
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      const hit =
        (c.type === "Identifier" && direct.has(c.name)) ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          c.property.name === "register" &&
          c.object.type === "Identifier" &&
          spaces.has(c.object.name));
      if (hit) out.push(n);
    },
  }).visit(parsed.program);
  return out.sort((x, y) => x.start - y.start);
}

/** Every function of a file, smallest first, so the first enclosing a position is the innermost. */
function functionsOf({ parsed }: Checked): ReadFn[] {
  const out: ReadFn[] = [];
  new Visitor({
    FunctionDeclaration: (f) => void out.push(f),
    FunctionExpression: (f) => void out.push(f),
    ArrowFunctionExpression: (f) => void out.push(f),
  }).visit(parsed.program);
  return out.sort((a, b) => a.end - a.start - (b.end - b.start));
}

/** The index of the parameter `name` of `fn` (a plain or defaulted identifier), or -1. */
function paramIndex(fn: ReadFn, name: string): number {
  return fn.params.findIndex(
    (p) =>
      (p.type === "Identifier" && p.name === name) ||
      (p.type === "AssignmentPattern" && p.left.type === "Identifier" && p.left.name === name),
  );
}

/** The functions `file` exports, under any name, as `exportedFunction` finds them. */
function exportedFns(checked: Checked, fileOf: ReturnType<typeof fileOfIn>): Set<ReadFn> {
  const names = new Set<string>();
  for (const st of checked.parsed.program.body) {
    if (st.type === "ExportDefaultDeclaration") names.add("default");
    if (st.type !== "ExportNamedDeclaration" || st.source !== null) continue;
    const d = st.declaration;
    if (d?.type === "FunctionDeclaration" && d.id !== null && d.id !== undefined) names.add(d.id.name);
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier") names.add(v.id.name);
    for (const sp of st.specifiers) names.add(sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value);
  }
  const out = new Set<ReadFn>();
  for (const n of names) {
    const hit = exportedFunction(n, checked.file, fileOf);
    if (hit !== undefined && hit.file.path === checked.file.path) out.add(hit.fn);
  }
  return out;
}

/** `${path}:${start}`: a function's key across the reads of one call. */
const fnKey = (path: string, fn: ReadFn): string => `${path}:${fn.start}`;

/**
 * A library's `register` calls whose name is a parameter of the exported function holding them (k.server-deps
 * Registration through a library): each such call, and each function's key to that parameter's index.
 */
function deferred(
  files: readonly Checked[],
  libs: RegisterLibraries,
  fileOf: ReturnType<typeof fileOfIn>,
): { calls: Set<CallExpression>; params: Map<string, number> } {
  const calls = new Set<CallExpression>();
  const params = new Map<string, number>();
  for (const checked of files) {
    if (!libs.isLibrary(checked.file.path)) continue;
    const found = registerCalls(checked);
    const named = found.filter((c) => c.arguments[0]?.type === "Identifier");
    if (named.length === 0) continue;
    const fns = functionsOf(checked);
    const exported = exportedFns(checked, fileOf);
    for (const call of named) {
      const arg = call.arguments[0];
      if (arg?.type !== "Identifier") continue;
      const holder = fns.find((f) => f.start <= call.start && f.end >= call.end && paramIndex(f, arg.name) >= 0);
      if (holder === undefined || !exported.has(holder)) continue;
      calls.add(call);
      params.set(fnKey(checked.file.path, holder), paramIndex(holder, arg.name));
    }
  }
  return { calls, params };
}

/**
 * The calls in `checked` of a library export whose `register` name is its parameter (`params`), each with the argument
 * for that parameter: the export imported by name from a library specifier, or read off a namespace import of one.
 */
function libraryCalls(
  checked: Checked,
  libs: RegisterLibraries,
  fileOf: ReturnType<typeof fileOfIn>,
  params: ReadonlyMap<string, number>,
): { call: CallExpression; name: string; arg: Argument | undefined }[] {
  const program = checked.parsed.program;
  const names = new Set<string>();
  const spaces = new Map<string, string>();
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type" || !libs.entries.has(st.source.value)) continue;
    for (const sp of st.specifiers)
      if (sp.type === "ImportNamespaceSpecifier") spaces.set(sp.local.name, st.source.value);
      else names.add(sp.local.name);
  }
  if (names.size === 0 && spaces.size === 0) return [];
  const out: { call: CallExpression; name: string; arg: Argument | undefined }[] = [];
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      let found: { fn: ReadFn; file: SourceFile } | undefined;
      let name = "";
      if (c.type === "Identifier" && names.has(c.name)) {
        name = c.name;
        found = localFunction(c.name, checked.file, fileOf);
      } else if (c.type === "MemberExpression" && !c.computed && c.object.type === "Identifier") {
        const spec = spaces.get(c.object.name);
        const entry = spec === undefined ? undefined : fileOf(checked.file, spec);
        name = c.property.name;
        found = entry === undefined ? undefined : exportedFunction(c.property.name, entry, fileOf);
      }
      const index = found === undefined ? undefined : params.get(fnKey(found.file.path, found.fn));
      if (index !== undefined) out.push({ call: n, name, arg: n.arguments[index] });
    },
  }).visit(program);
  return out;
}

/**
 * E1607 (k.data, k.server-deps Registration through a library): a `register` of `@keel/ctx` in a file under
 * `modules/<id>/` whose name is not a string literal `<id>.<name>`, `<name>` one lowerCamel segment; or a name another
 * app file of the project registers too, at the call in the file whose path sorts later. In a library's file, a
 * `register` whose name is a parameter of the exported function holding it is judged at each call of that export
 * instead: by the argument for the parameter, against the calling file's `<id>` (at the argument; at the call when it
 * has none), and a literal one joins the names the duplicate half compares. `dirs` are the project roots
 * (`projectDirs`), deepest first.
 */
export function registerNames(
  files: readonly Checked[],
  dirs: readonly string[],
  libs: RegisterLibraries = { entries: new Map(), isLibrary: () => false },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const first = new Map<string, { path: string; line: number }>();
  const ordered = [...files].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  const fileOf = fileOfIn(
    files.map((c) => c.file),
    libs.entries,
  );
  const later = deferred(ordered, libs, fileOf);
  for (const checked of ordered) {
    const { file } = checked;
    if (!isAppPath(file.path)) continue;
    const dir = dirs.find((d) => file.path.startsWith(d)) ?? "";
    const id = MODULE_DIR.exec(file.path.slice(dir.length))?.[1];
    const calls: Call[] = registerCalls(checked)
      .filter((c) => !later.calls.has(c))
      .map((c) => ({ at: c.start, name: literal(c.arguments[0]), by: "register" }));
    if (later.params.size > 0)
      for (const { call, name, arg } of libraryCalls(checked, libs, fileOf, later.params))
        calls.push({
          at: arg === undefined ? call.start : arg.start,
          name: literal(arg),
          by: clipMessage(name, 20),
        });
    calls.sort((x, y) => x.at - y.at);
    for (const call of calls) {
      if (id !== undefined && !wellNamed(call.name, id)) {
        const shown =
          call.name === undefined ? "a name that is not a string literal" : `"${clipMessage(call.name, 30)}"`;
        out.push(
          diagAt(
            file,
            call.at,
            "E1607",
            `${call.by} of ${shown}: name it '${clipMessage(id, 20)}.<lowerCamel>'`,
            "k.data",
          ),
        );
        continue;
      }
      if (call.name === undefined) continue;
      const key = `${dir}\0${call.name}`;
      const prior = first.get(key);
      if (prior === undefined) {
        first.set(key, { path: file.path, line: lineCol(file.source, call.at).line });
        continue;
      }
      if (prior.path === file.path) continue;
      const message = `capability "${clipMessage(call.name, 30)}" also registered at ${prior.path.slice(-30)}:${prior.line}`;
      out.push(diagAt(file, call.at, "E1607", message, "k.data"));
    }
  }
  return out;
}

/** Whether `name` is `<id>.<name>` with `<name>` one lowerCamel segment. */
function wellNamed(name: string | undefined, id: string): boolean {
  if (name === undefined || !name.startsWith(`${id}.`)) return false;
  return LOWER_CAMEL.test(name.slice(id.length + 1));
}
