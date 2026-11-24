import type { Edit } from "@keel/check";

/** The edits removing items `drop` of a comma-separated list with spans `items`, each run of neighbours with its comma. */
export function removals(
  items: readonly { readonly start: number; readonly end: number }[],
  drop: readonly number[],
): Edit[] {
  const out: Edit[] = [];
  const gone = new Set(drop);
  let i = 0;
  while (i < items.length) {
    const first = items[i];
    if (!gone.has(i) || first === undefined) {
      i += 1;
      continue;
    }
    let last = i;
    while (gone.has(last + 1)) last += 1;
    const lastItem = items[last];
    const next = items[last + 1];
    const prev = items[i - 1];
    if (lastItem !== undefined) {
      if (next !== undefined) out.push({ start: first.start, end: next.start, text: "" });
      else out.push({ start: prev === undefined ? first.start : prev.end, end: lastItem.end, text: "" });
    }
    i = last + 1;
  }
  return out;
}
