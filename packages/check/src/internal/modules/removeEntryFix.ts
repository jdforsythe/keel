import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { ManifestList } from "./ManifestList.ts";

/** Fix (unified diff of the manifest) removing entry `index` of a manifest list with its separator. */
export function removeEntryFix(manifest: SourceFile, list: ManifestList, index: number): string | undefined {
  const e = list.entries[index];
  if (e === undefined || list.span === null) return undefined;
  const next = list.entries[index + 1];
  const prev = list.entries[index - 1];
  const edit =
    next !== undefined
      ? { start: e.start, end: next.start, text: "" }
      : prev !== undefined
        ? { start: prev.end, end: e.end, text: "" }
        : { start: list.span.start, end: list.span.end, text: "[]" };
  const fix = unifiedDiff(manifest.path, manifest.source, applyEdits(manifest.source, [edit]));
  return fix === "" ? undefined : fix;
}
