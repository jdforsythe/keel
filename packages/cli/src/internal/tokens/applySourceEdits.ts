import type { SourceEdit } from "./SourceEdit.ts";

/** `source` with `edits` applied; they must not overlap, and insertions at one offset keep the order given. */
export function applySourceEdits(source: string, edits: readonly SourceEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let out = "";
  let at = 0;
  for (const e of sorted) {
    out += source.slice(at, e.start) + e.text;
    at = e.end;
  }
  return out + source.slice(at);
}
