import type { Schedule, SimCtx } from "@keel/ctx";

/**
 * A `simulate` scenario: runs on `ctx`, a sim ctx made from the run's `seed` and `schedule`, whose clock the run drives
 * while the scenario is pending. `run()` waits until the run is idle with nothing due within the horizon; `run(ms)`
 * waits to exactly `ms` after the call (an integer 0 to 600,000); `run(0)` settles work without moving the clock.
 */
export type Scenario = (run: {
  readonly ctx: SimCtx;
  readonly seed: number;
  readonly schedule: Schedule;
  readonly run: (ms?: number) => Promise<void>;
}) => Promise<void> | void;
