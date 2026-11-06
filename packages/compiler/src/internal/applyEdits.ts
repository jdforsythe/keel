import type { Edit } from "./Edit.ts";

/** Apply non-overlapping edits (absolute offsets) to `source.slice(start, end)`. Overlapping later edits are skipped. */
export function applyEdits(source: string, start: number, end: number, edits: readonly Edit[]): string {
  const sorted = edits.filter((e) => e.start >= start && e.end <= end).sort((x, y) => x.start - y.start);
  let out = "";
  let pos = start;
  for (const e of sorted) {
    if (e.start < pos) continue;
    out += source.slice(pos, e.start) + e.text;
    pos = e.end;
  }
  return out + source.slice(pos, end);
}
