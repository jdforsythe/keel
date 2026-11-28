/**
 * `KEEL_TEST_TIME_SCALE` (docs/TESTING.md Time scale): a positive number, default 1. Any other value is a mistake the
 * run must not hide, so it throws.
 */
export function timeScale(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.KEEL_TEST_TIME_SCALE;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`KEEL_TEST_TIME_SCALE must be a positive number, not ${raw}`);
  return n;
}
