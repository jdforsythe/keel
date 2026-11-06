import type { Span } from "./Span.ts";

/**
 * Build a containment test for a set of spans in O(m log m): `test(n)` is true when some span contains
 * `n`. Uses spans sorted by start with a running maximum of ends, queried by binary search.
 */
export function coverage(spans: readonly Span[]): (n: Span) => boolean {
  const sorted = [...spans].sort((x, y) => x.start - y.start);
  const starts = sorted.map((s) => s.start);
  const maxEnd: number[] = [];
  let m = Number.NEGATIVE_INFINITY;
  for (const s of sorted) {
    m = Math.max(m, s.end);
    maxEnd.push(m);
  }
  return (n) => {
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((starts[mid] ?? 0) <= n.start) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && (maxEnd[lo - 1] ?? Number.NEGATIVE_INFINITY) >= n.end;
  };
}
