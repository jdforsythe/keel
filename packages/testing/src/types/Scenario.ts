import type { Schedule, SimCtx } from "@keel/ctx";

/**
 * A `simulate` scenario: runs on `ctx`, a sim ctx made from the run's `seed` and `schedule`. `run()` settles, then
 * steps the sim clock through every deadline due within the horizon, settling after each.
 */
export type Scenario = (run: {
  readonly ctx: SimCtx;
  readonly seed: number;
  readonly schedule: Schedule;
  readonly run: () => Promise<void>;
}) => Promise<void> | void;
