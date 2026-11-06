import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import { Visitor } from "oxc-parser";
import { turboJson } from "../templates/turboJson.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { RenameSpec } from "./RenameSpec.ts";
import type { Writes } from "./Writes.ts";
import { commit } from "./commit.ts";
import { dirOf } from "./dirOf.ts";
import { fail } from "./fail.ts";
import { isCode } from "./isCode.ts";
import { isGenerated } from "./isGenerated.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { moduleIds } from "./moduleIds.ts";
import { parseSource } from "./parseSource.ts";
import { renameSource } from "./renameSource.ts";
import { routeId } from "./routeId.ts";
import { routeTable } from "./routeTable.ts";
import { sortedKeys } from "./sortedKeys.ts";

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

/**
 * `codemod rename module <from> <to>`: moves `modules/<from>` to `modules/<to>`, rewrites the manifest id and
 * the module's entry in other manifests' `deps` and in `topology.ts`, every route and store id that starts with
 * `<from>.`, imports of the moved files, and files under `test/` named `<from>.*`. turbo.json is regenerated
 * when the project has one.
 */
export function renameModule(
  from: string,
  to: string,
  files: ReadonlyMap<string, string>,
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
  const tokens = new Map<string, string>();
  for (const id of routeTable(files).keys())
    if (routeId(id)?.mod === from) tokens.set(id, `${to}${id.slice(from.length)}`);
  for (const p of files.keys()) {
    const m = new RegExp(`^modules/${from}/([^/.]+)\\.store\\.ts$`).exec(p);
    if (m?.[1] !== undefined) tokens.set(`${from}.${m[1]}`, `${to}.${m[1]}`);
  }
  const spec: RenameSpec = { names: new Map(), leaf: null, tokens, paths, route: null, exactAnywhere: false };
  const writes: Writes = new Map();
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    if (src === undefined || isGenerated(path)) continue;
    const next = paths.get(path) ?? path;
    let out = src;
    if (isCode(path)) {
      out = renameSource(files, path, next, src, spec, false);
      if (/(^|\/)module\.ts$/.test(path) || path === "topology.ts") out = renameLiterals(path, out, from, to);
    }
    if (next !== path) {
      writes.set(path, null);
      writes.set(next, out);
    } else if (out !== src) writes.set(path, out);
  }
  if (files.has("turbo.json")) {
    const rest = moduleIds(files).filter((m) => m !== from);
    writes.set("turbo.json", turboJson([...rest, to]));
  }
  return commit(files, writes, files.has("turbo.json") ? ["turbo.json"] : []);
}
