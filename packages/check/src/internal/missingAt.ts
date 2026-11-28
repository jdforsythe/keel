/**
 * The breakpoint a `gap` needs a `direction` at, or `undefined` when one covers it: `gap`'s smallest key, where
 * `base` is smallest and the breakpoints follow `order` (the `breakpoint` token order). A `direction` covers it when
 * it is computed (`null`) or has a key at or below that one. A key not in `order` ranks above every token, so two
 * unknown keys never disagree.
 */
export function missingAt(
  gap: readonly string[],
  directions: readonly (readonly string[] | null)[],
  order: readonly string[],
): string | undefined {
  const rank = (k: string): number => {
    if (k === "base") return 0;
    const i = order.indexOf(k);
    return i < 0 ? Number.POSITIVE_INFINITY : i + 1;
  };
  const smallest = [...gap].sort((a, b) => rank(a) - rank(b))[0];
  if (smallest === undefined) return undefined;
  const r = rank(smallest);
  const covered = directions.some((d) => d === null || d.some((k) => rank(k) <= r));
  return covered ? undefined : smallest;
}
