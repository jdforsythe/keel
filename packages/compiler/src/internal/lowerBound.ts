/** First index in `items` (sorted by `start`) whose `start` is >= `pos`. */
export function lowerBound(items: readonly { start: number }[], pos: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((items[mid]?.start ?? 0) < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
