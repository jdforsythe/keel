import type { Drivers } from "./Drivers.ts";
import type { Mode } from "./Mode.ts";
import type { Schedule } from "./Schedule.schema.ts";

/**
 * Options for createCtx. `mode` defaults to sim under KEEL_TEST=1, else real. `seed` (default 0) drives sim.
 * `drivers` (real and shell only, else E1605) replaces the platform `storage` or `net` (for example `fileStorage(path)`
 * from `@keel/ctx/node`). `schedule` (sim only) fixes delays, faults, offline windows and capability plans (k.sim).
 */
export interface CtxOptions {
  readonly mode?: Mode;
  readonly seed?: number | undefined;
  readonly drivers?: Drivers;
  readonly schedule?: Schedule;
}
