import type { Tally } from "../Tally.schema.ts";

/** The sum of two tallies: counts added per name (keys sorted), the earlier `from`, the later `to`. */
export function mergeTally(a: Tally, b: Tally): Tally {
  const tx: Record<string, number> = {};
  for (const name of [...new Set([...Object.keys(a.tx), ...Object.keys(b.tx)])].sort())
    tx[name] = (a.tx[name] ?? 0) + (b.tx[name] ?? 0);
  return { v: 1, from: Math.min(a.from, b.from), to: Math.max(a.to, b.to), tx };
}
