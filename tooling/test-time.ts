// The one place a test's time bound is scaled. `KEEL_TEST_TIME_SCALE` (a positive number, default 1) multiplies every
// time bound the repository's tests set: a run that passes here with every bound divided by N passes on a machine N
// times slower, so `KEEL_TEST_TIME_SCALE=0.1` finds the bounds a runner ten times slower would cut. keelConfig scales
// vitest's `testTimeout` and `hookTimeout` and every timeout a test file
// passes to `it`, `test`, `describe` or a hook (test-times.ts). The watchdog's grace, its collection allowance and
// the bound on its own hooks, and the property-time transform's time per run, are the machine's own work, not a bound
// a test chose: they are fixed time.
// A bound a test or smoke sets itself (a wait for a child process, a browser, a server) goes through `testTime`. A
// time that is an input to the code under test (a lease, a heartbeat, a retry delay the test asserts on) is not a
// bound and does not scale: it goes through `fixedTime`, which says so. Structure-lint S0016 refuses a hard-coded
// time in a test, conformance file or smoke that goes through neither.

/** `KEEL_TEST_TIME_SCALE` as a positive finite number; 1 when unset or empty. Any other value throws. */
export function testTimeScale(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.KEEL_TEST_TIME_SCALE;
  if (raw === undefined || raw.trim() === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`KEEL_TEST_TIME_SCALE must be a positive number, not "${raw}"`);
  return n;
}

/** A test's time bound of `ms` milliseconds, scaled by `KEEL_TEST_TIME_SCALE`: at least 1 ms. */
export function testTime(ms: number): number {
  return Math.max(1, Math.round(ms * testTimeScale()));
}

/** A time that is an input to the code under test, not a bound on the test: `ms` as given, never scaled. */
export function fixedTime(ms: number): number {
  return ms;
}
