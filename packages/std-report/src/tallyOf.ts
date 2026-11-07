import type { Tally } from "./Tally.ts";

/**
 * Count each distinct non-empty key into a `report.tally` record (std.report): rows by `n` descending, then `key`
 * ascending. Keys over 60 characters fail `Tally` (`respond` reports E1054); `id` is the caller's.
 */
export function tallyOf(id: string, keys: readonly string[]): Tally {
  const counts = new Map<string, number>();
  for (const k of keys) if (k !== "") counts.set(k, (counts.get(k) ?? 0) + 1);
  const rows = [...counts]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { kind: "report.tally", id, rows };
}
