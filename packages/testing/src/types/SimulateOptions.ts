/**
 * Options of `simulate` (k.sim): `runs` (default 100), `seed` (default `KEEL_SEED`, else 1337), `horizon` in sim ms
 * past a run's start (default 600,000), `budget` in real ms (default the test's timeout less a tenth, k.drive), `law` (default false: run each run twice and compare its trace, k.drive), and
 * `replay`, a `SimRun` (as JSON) to run once instead of generating.
 */
export interface SimulateOptions {
  readonly runs?: number;
  readonly seed?: number;
  readonly horizon?: number;
  readonly budget?: number;
  readonly law?: boolean;
  readonly replay?: unknown;
}
