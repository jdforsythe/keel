import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { ManifestList } from "./ManifestList.ts";
import { inNodeModules } from "./inNodeModules.ts";

/**
 * Fix (unified diff of the manifest) appending `value` (or each of several) to a manifest list, quoted like its first
 * entry. An absent list is added as `<key>: [...]` after the manifest's last property when `add` names both; else
 * `undefined`, as for a manifest that is an installed package under `node_modules/` (k.module: no fix edits it).
 */
export function addEntryFix(
  manifest: SourceFile,
  list: ManifestList,
  value: string | readonly string[],
  add?: { readonly key: string; readonly at: number },
): string | undefined {
  if (inNodeModules(manifest.path)) return undefined;
  const first = list.entries[0];
  const q = first !== undefined && manifest.source[first.start] === '"' ? '"' : "'";
  const text = (typeof value === "string" ? [value] : value).map((v) => `${q}${v}${q}`).join(", ");
  const last = list.entries[list.entries.length - 1];
  const edit =
    list.span === null
      ? add === undefined
        ? undefined
        : { start: add.at, end: add.at, text: `, ${add.key}: [${text}]` }
      : last === undefined
        ? { start: list.span.start, end: list.span.end, text: `[${text}]` }
        : { start: last.end, end: last.end, text: `, ${text}` };
  if (edit === undefined) return undefined;
  const fix = unifiedDiff(manifest.path, manifest.source, applyEdits(manifest.source, [edit]));
  return fix === "" ? undefined : fix;
}
