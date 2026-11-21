import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import { Visitor } from "oxc-parser";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { RenameSpec } from "./RenameSpec.ts";
import type { Writes } from "./Writes.ts";
import { commit } from "./commit.ts";
import { dirOf } from "./dirOf.ts";
import { fail } from "./fail.ts";
import { importRefs } from "./importRefs.ts";
import { isCode } from "./isCode.ts";
import { isGenerated } from "./isGenerated.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { moduleIds } from "./moduleIds.ts";
import { parseSource } from "./parseSource.ts";
import { regenerated } from "./regenerated.ts";
import { renameSource } from "./renameSource.ts";
import { resolveImport } from "./resolveImport.ts";
import { routeId } from "./routeId.ts";
import { routeTable } from "./routeTable.ts";
import { sortedKeys } from "./sortedKeys.ts";
import { withWrites } from "./withWrites.ts";

/** Rewrite every string literal equal to `from` (module ids in manifests and topology) to `to`. */
function renameLiterals(path: string, src: string, from: string, to: string): string {
  const program = parseSource(path, src);
  if (program === null) return src;
  const ms = new MagicString(src);
  const keys = new Set<number>();
  new Visitor({
    Property: (n) => {
      if (!n.computed) keys.add(n.key.start);
    },
    Literal: (n) => {
      if (n.value === from && !keys.has(n.start)) ms.overwrite(n.start + 1, n.end - 1, to);
    },
  }).visit(program);
  return ms.toString();
}

/** True when `path` is the module's contract file or imports it: the files where the contract's export `<id>` is a binding or a reference. */
function usesContract(files: ReadonlyMap<string, string>, path: string, contract: string): boolean {
  if (path === contract) return true;
  const program = isCode(path) ? parseSource(path, files.get(path) ?? "") : null;
  return program !== null && importRefs(program).some((r) => resolveImport(files, path, r.spec) === contract);
}

/**
 * `codemod rename module <from> <to>`: moves `modules/<from>` to `modules/<to>`, rewrites the manifest id and
 * the module's entry in other manifests' `deps` and in `topology.ts`, the contract file and its export, every route and store id that starts with
 * `<from>.`, imports of the moved files, and files under `test/` named `<from>.*`. turbo.json, the CI workflow and
 * the deploy files are regenerated when the project has them.
 */
export function renameModule(
  from: string,
  to: string,
  files: ReadonlyMap<string, string>,
  shells: DeployShells = {},
): Result<Edit, ScaffoldError> {
  if (!isLowerCamel(to)) return fail("E1352", to, `module id ${to} must be lowerCamel`);
  if (!files.has(`modules/${from}/module.ts`)) return fail("E1052", from, `no module ${from}`);
  for (const p of files.keys())
    if (p.startsWith(`modules/${to}/`)) return fail("E1351", `modules/${to}`, `module ${to} already exists`);
  const paths = new Map<string, string>();
  for (const p of files.keys()) {
    if (isGenerated(p)) continue;
    if (p.startsWith(`modules/${from}/`)) paths.set(p, `modules/${to}/${p.slice(`modules/${from}/`.length)}`);
    else if (dirOf(p) === "test" && p.startsWith(`test/${from}.`))
      paths.set(p, `test/${to}.${p.slice(`test/${from}.`.length)}`);
  }
  const oldContract = `modules/${from}/${from}.contract.ts`;
  const newContract = `modules/${to}/${to}.contract.ts`;
  if (files.has(oldContract)) paths.set(oldContract, newContract);
  const tokens = new Map<string, string>();
  for (const id of routeTable(files).keys())
    if (routeId(id)?.mod === from) tokens.set(id, `${to}${id.slice(from.length)}`);
  for (const p of files.keys()) {
    const m = new RegExp(`^modules/${from}/([^/.]+)\\.store\\.ts$`).exec(p);
    if (m?.[1] !== undefined) tokens.set(`${from}.${m[1]}`, `${to}.${m[1]}`);
  }
  const names = files.has(oldContract) ? new Map([[from, to]]) : new Map<string, string>();
  const spec: RenameSpec = { names, leaf: null, tokens, paths, route: null, exactAnywhere: false };
  const writes: Writes = new Map();
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    if (src === undefined || isGenerated(path)) continue;
    const next = paths.get(path) ?? path;
    let out = src;
    if (isCode(path)) {
      out = renameSource(files, path, next, src, spec, names.size > 0 && usesContract(files, path, oldContract));
      if (/(^|\/)module\.ts$/.test(path) || path === "topology.ts" || path === oldContract)
        out = renameLiterals(path, out, from, to);
    }
    if (next !== path) {
      writes.set(path, null);
      writes.set(next, out);
    } else if (out !== src) writes.set(path, out);
  }
  const gen = regenerated(withWrites(files, writes), shells);
  return commit(files, new Map([...writes, ...gen]), [...gen.keys()]);
}
