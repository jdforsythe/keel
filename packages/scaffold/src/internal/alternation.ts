/** A regex alternation of the literal keys, longest first. */
export function alternation(keys: Iterable<string>): string {
  return [...keys]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
}
