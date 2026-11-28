import type { Result } from "@keel/schema";
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
import { parseSource } from "./parseSource.ts";
import { renameSource } from "./renameSource.ts";
import { resolveImport } from "./resolveImport.ts";
import { sortedKeys } from "./sortedKeys.ts";

/**
 * Whether `path` is the `module.ts` of a folder holding `dir`: the manifest whose `public.exports` may name what
 * `dir` declares (a library's root `module.ts` over `src/`, k.library-pack).
 */
const owns = (path: string, dir: string): boolean => {
  if (!/(^|\/)module\.ts$/.test(path)) return false;
  const base = dirOf(path);
  return base === "" || dir === base || dir.startsWith(`${base}/`);
};

/**
 * Compute and commit a rename's edit set. Files in the declaring folder, the renamed files, files importing a
 * renamed file, and each `module.ts` over the declaring folder are in scope (identifiers and name-shaped strings
 * follow); every other source file only has its dotted id tokens and import specifiers updated. Generated locations
 * are never touched.
 */
export function applyRename(
  files: ReadonlyMap<string, string>,
  dir: string,
  spec: RenameSpec,
): Result<Edit, ScaffoldError> {
  for (const [from, to] of spec.paths)
    if (files.has(to) && !spec.paths.has(to)) return fail("E1351", to, `${to} already exists (renaming ${from})`);
  const writes: Writes = new Map();
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    if (src === undefined || isGenerated(path)) continue;
    const next = spec.paths.get(path) ?? path;
    let out = src;
    if (isCode(path)) {
      const program = parseSource(path, src);
      const importsRenamed =
        program !== null &&
        importRefs(program).some((r) => {
          const t = resolveImport(files, path, r.spec);
          return t !== null && spec.paths.has(t);
        });
      const inScope = dirOf(path) === dir || spec.paths.has(path) || importsRenamed || owns(path, dir);
      out = renameSource(files, path, next, src, spec, inScope);
    }
    if (next !== path) {
      writes.set(path, null);
      writes.set(next, out);
    } else if (out !== src) writes.set(path, out);
  }
  return commit(files, writes);
}
