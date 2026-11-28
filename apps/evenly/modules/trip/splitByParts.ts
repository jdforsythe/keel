/**
 * Divides `amount` among people by their `parts`, to the unit: each share is the rounded-down proportional share, and
 * the units left over go one each to the people with the largest remainders (the earlier person on a tie). The shares
 * add up to `amount` exactly, and a person with no parts owes nothing. `parts` must hold at least one part in all.
 */
export default function splitByParts(amount: number, parts: readonly number[]): number[] {
  const total = parts.reduce((sum, n) => sum + n, 0);
  const floors = parts.map((n) => Math.floor((amount * n) / total));
  const rest = amount - floors.reduce((sum, n) => sum + n, 0);
  const order = parts
    .map((n, i) => ({ i, left: amount * n - (floors[i] ?? 0) * total }))
    .filter((r) => (parts[r.i] ?? 0) > 0)
    .sort((a, b) => b.left - a.left || a.i - b.i);
  const extra = new Set(order.slice(0, rest).map((r) => r.i));
  return floors.map((n, i) => (extra.has(i) ? n + 1 : n));
}
