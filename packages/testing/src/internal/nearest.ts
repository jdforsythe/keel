import { levenshtein } from "./levenshtein.ts";

/** Up to `n` candidates closest to `target` by edit distance; ties keep candidate order. */
export function nearest(target: string, candidates: readonly string[], n: number): string[] {
  return candidates
    .map((c, i) => ({ c, i, d: levenshtein(target, c) }))
    .sort((x, y) => x.d - y.d || x.i - y.i)
    .slice(0, n)
    .map((x) => x.c);
}
