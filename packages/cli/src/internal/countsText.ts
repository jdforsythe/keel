/** `2 files, 0 errors` from a counts record, in insertion order. */
export function countsText(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
