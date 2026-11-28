import { localMinute } from "./localMinute.ts";

/**
 * The minute (after the epoch) that wall time `w` fires at in `zone` (std.schedules): its first occurrence when a
 * clock change repeats it, the first minute after the gap when one skips it.
 */
export function fireAt(zone: string, w: number): number {
  const a = w - (localMinute(zone, w - 1440) - (w - 1440));
  const b = w - (localMinute(zone, w + 1440) - (w + 1440));
  const hits = (a === b ? [a] : [a, b]).filter((i) => localMinute(zone, i) === w);
  if (hits.length > 0) return Math.min(...hits);
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localMinute(zone, mid) > w) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
