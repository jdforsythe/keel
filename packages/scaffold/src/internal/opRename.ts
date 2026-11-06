import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { RenameSpec } from "./RenameSpec.ts";
import { applyRename } from "./applyRename.ts";
import { badInput } from "./badInput.ts";
import { basenames } from "./basenames.ts";
import { dirOf } from "./dirOf.ts";
import { fail } from "./fail.ts";
import { findSchema } from "./findSchema.ts";
import { inputs } from "./inputs.ts";
import { isGenerated } from "./isGenerated.ts";
import { isPascal } from "./isPascal.ts";
import { pascal } from "./pascal.ts";
import { routeId } from "./routeId.ts";
import { routeTable } from "./routeTable.ts";
import { storeId } from "./storeId.ts";

/** Old -> new paths of the files in `dir` whose name starts with one of the `prefixes` (old -> new). */
function renamedFiles(
  files: ReadonlyMap<string, string>,
  dir: string,
  prefixes: readonly (readonly [string, string])[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of files.keys()) {
    if (dirOf(p) !== dir || isGenerated(p)) continue;
    const base = p.slice(dir.length + 1);
    for (const [a, b] of prefixes)
      if (base.startsWith(a)) {
        out.set(p, `${dir}/${b}${base.slice(a.length)}`);
        break;
      }
  }
  return out;
}

const spec = (
  names: [string, string][],
  tokens: [string, string][],
  paths: Map<string, string>,
  route: RenameSpec["route"],
  exactAnywhere: boolean,
): RenameSpec => ({ names: new Map(names), tokens: new Map(tokens), paths, route, exactAnywhere });

/**
 * `codemod rename <from> <to>` for a component, store, route or schema: the declaration, its files, every
 * import, identifier reference, `href()`/`uses:`/element-id string, test, and manifest entry.
 */
export function opRename(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.rename.parse(input);
  if (!r.ok) return badInput("rename", r.error);
  const { kind, from, to } = r.value;
  if (from === to) return fail("E1351", to, `${to} already exists`);
  if (kind === "component" || kind === "schema") {
    if (!isPascal(to)) return fail("E1352", to, `${kind} name ${to} must be PascalCase`);
    const decls = kind === "component" ? basenames(files, `${from}.tsx`, true) : findSchema(files, from);
    const decl = decls[0];
    if (decl === undefined) return fail("E1052", from, `no ${kind} named ${from}`);
    const gen = decls.find(isGenerated);
    if (gen !== undefined) return fail("E1005", gen, `${from} is declared in generated ${gen}; regenerate instead`);
    const taken = kind === "component" ? basenames(files, `${to}.tsx`, true) : findSchema(files, to);
    if (taken[0] !== undefined) return fail("E1351", taken[0], `${kind} ${to} already exists`);
    const dir = dirOf(decl);
    const paths = renamedFiles(files, dir, [[`${from}.`, `${to}.`]]);
    return applyRename(files, dir, spec([[from, to]], [], paths, null, true));
  }
  if (kind === "store") {
    const a = storeId(from);
    const b = storeId(to);
    if (a === null) return fail("E1052", from, `${from} is not a store id`);
    if (b === null) return fail("E1352", to, `store id ${to} must be <module>.<name>, both lowerCamel`);
    if (a.mod !== b.mod) return fail("E1352", to, `rename keeps the module (${a.mod}); use codemod move`);
    const dir = `modules/${a.mod}`;
    if (!files.has(`${dir}/${a.name}.store.ts`)) return fail("E1052", from, `no store ${from}`);
    if (files.has(`${dir}/${b.name}.store.ts`)) return fail("E1351", `${dir}/${b.name}.store.ts`, `store ${to} exists`);
    const sa = `${pascal(a.name)}State`;
    const sb = `${pascal(b.name)}State`;
    const paths = renamedFiles(files, dir, [
      [`${a.name}.store.`, `${b.name}.store.`],
      [`${sa}.`, `${sb}.`],
    ]);
    const names: [string, string][] = [
      [a.name, b.name],
      [sa, sb],
    ];
    return applyRename(files, dir, spec(names, [[from, to]], paths, null, false));
  }
  const a = routeId(from);
  const b = routeId(to);
  if (a === null) return fail("E1052", from, `${from} is not a route id`);
  if (b === null) return fail("E1352", to, `route id ${to} must be dotted lowerCamel segments prefixed by a module`);
  if (a.mod !== b.mod) return fail("E1352", to, `rename keeps the module (${a.mod}); use codemod move`);
  const table = routeTable(files);
  const decl = table.get(from);
  if (decl === undefined) return fail("E1052", from, `no route ${from}`);
  const taken = table.get(to);
  if (taken !== undefined) return fail("E1351", taken.file, `route ${to} already exists`);
  const dir = dirOf(decl.file);
  const [pa, pb] = [pascal(a.leaf), pascal(b.leaf)];
  const paths = renamedFiles(files, dir, [
    [`${a.leaf}.server.`, `${b.leaf}.server.`],
    [`${a.leaf}.route.`, `${b.leaf}.route.`],
    [`${pa}Page.`, `${pb}Page.`],
  ]);
  const names: [string, string][] = [
    [a.leaf, b.leaf],
    [`load${pa}`, `load${pb}`],
    [`${pa}Page`, `${pb}Page`],
  ];
  const lastOf = (id: string): string => id.slice(id.lastIndexOf(".") + 1);
  const route = { id: from, from: lastOf(from), to: lastOf(to) };
  return applyRename(files, dir, spec(names, [[from, to]], paths, route, false));
}
