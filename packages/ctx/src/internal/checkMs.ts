/** `after(ms)` and `advance(ms)` need a finite ms >= 0 so time stays monotonic. */
export function checkMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`ms must be finite and >= 0, got ${ms}`);
}
