import type { Edit } from "../types/Edit.ts";

/** Apply non-overlapping edits to `source` (any order); overlapping edits after the first are dropped. */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = "";
  let at = 0;
  for (const e of sorted) {
    if (e.start < at) continue;
    out += source.slice(at, e.start) + e.text;
    at = e.end;
  }
  return out + source.slice(at);
}
