/** The lowest and highest of `values`, each widened to take in 0 when `withZero`; `{ lo: 0, hi: 0 }` for none. */
export function extent(values: readonly number[], withZero: boolean): { readonly lo: number; readonly hi: number } {
  let lo = withZero || values.length === 0 ? 0 : Number.POSITIVE_INFINITY;
  let hi = withZero || values.length === 0 ? 0 : Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { lo, hi };
}
