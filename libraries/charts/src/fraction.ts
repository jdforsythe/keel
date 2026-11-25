/**
 * Where `v` lies between `lo` and `hi`, from 0 at `lo` to 1 at `hi`; 0.5 when `lo` equals `hi`. Each term is halved
 * first, so two finite numbers as far apart as `-Number.MAX_VALUE` and `Number.MAX_VALUE` give a finite span.
 */
export function fraction(lo: number, hi: number, v: number): number {
  const span = hi / 2 - lo / 2;
  if (span === 0) return 0.5;
  const t = (v / 2 - lo / 2) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
