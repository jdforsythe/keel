import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { ManifestList } from "./ManifestList.ts";

/**
 * Fix (unified diff of the manifest) appending `value` to a manifest list, quoted like its first entry.
 * `undefined` when the list is absent from the manifest (nothing to edit in place).
 */
export function addEntryFix(manifest: SourceFile, list: ManifestList, value: string): string | undefined {
  if (list.span === null) return undefined;
  const first = list.entries[0];
  const q = first !== undefined && manifest.source[first.start] === '"' ? '"' : "'";
  const text = `${q}${value}${q}`;
  const last = list.entries[list.entries.length - 1];
  const edit =
    last === undefined
      ? { start: list.span.start, end: list.span.end, text: `[${text}]` }
      : { start: last.end, end: last.end, text: `, ${text}` };
  const fix = unifiedDiff(manifest.path, manifest.source, applyEdits(manifest.source, [edit]));
  return fix === "" ? undefined : fix;
}
