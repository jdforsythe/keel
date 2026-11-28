/** The wait after a job's `n`th run failed (std.jobs): `min(1000 * 2^(n-1), 3600000)` ms. */
export function backoff(n: number): number {
  return Math.min(1000 * 2 ** (n - 1), 3_600_000);
}
