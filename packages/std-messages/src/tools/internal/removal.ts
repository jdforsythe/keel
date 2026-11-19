import type { Edit } from "@keel/check";

/** The edit removing item `i` of a comma-separated list with spans `items`, with the comma that joins it. */
export function removal(items: readonly { readonly start: number; readonly end: number }[], i: number): Edit[] {
  const item = items[i];
  if (item === undefined) return [];
  const next = items[i + 1];
  const prev = items[i - 1];
  if (next !== undefined) return [{ start: item.start, end: next.start, text: "" }];
  return [{ start: prev === undefined ? item.start : prev.end, end: item.end, text: "" }];
}
