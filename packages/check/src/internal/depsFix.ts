import type { SourceFile } from "../types/SourceFile.ts";
import { applyEdits } from "./applyEdits.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/**
 * E1108's fix (k.formats): `pkg` added to the `deps` of the module holding `path` (`modules/<id>/module.ts` among
 * `files`), or `""` when there is no package, no such manifest, no literal `deps` array, or the manifest names it.
 */
export function depsFix(path: string, pkg: string | null, files: ReadonlyMap<string, string>): string {
  const dir = /^(?:.*\/)?modules\/[^/]+\//.exec(path)?.[0];
  const at = dir === undefined ? undefined : `${dir}module.ts`;
  const source = at === undefined ? undefined : files.get(at);
  const open = source === undefined ? null : /\bdeps\s*:\s*\[(\s*)(\]?)/.exec(source);
  if (pkg === null || at === undefined || source === undefined || open === null || source.includes(`'${pkg}'`))
    return "";
  const start = open.index + open[0].length - (open[1] ?? "").length - (open[2] ?? "").length;
  const text = open[2] === "]" ? `'${pkg}'` : `'${pkg}', `;
  return unifiedDiff(at, source, applyEdits(source, [{ start, end: start, text }]));
}
