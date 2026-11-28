/** The name of `names` closest to `name` by edit distance, the first declared on a tie; undefined when there is none. */
export function nearest(name: string, names: readonly string[]): string | undefined {
  let best: string | undefined;
  let low = Number.POSITIVE_INFINITY;
  for (const n of names) {
    let row = Array.from({ length: n.length + 1 }, (_, j) => j);
    for (let i = 1; i <= name.length; i++) {
      const next = [i];
      for (let j = 1; j <= n.length; j++)
        next.push(
          Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (name[i - 1] === n[j - 1] ? 0 : 1)),
        );
      row = next;
    }
    const d = row[n.length] ?? 0;
    if (d < low) [best, low] = [n, d];
  }
  return best;
}
