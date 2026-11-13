import type { KeyValueStorage } from "./KeyValueStorage.ts";
import type { Mode } from "./Mode.ts";
import type { Schedule } from "./Schedule.schema.ts";

/**
 * Options for createCtx. `mode` defaults to sim under KEEL_TEST=1, else real. `seed` (default 0) drives sim.
 * `storage` backs `ctx.storage` in real and shell modes in place of the platform `localStorage` (for example
 * `fileStorage(path)` from `@keel/ctx/node`); sim storage is always an in-memory map. `schedule` (sim only) fixes
 * delays, faults, offline windows and capability plans (k.sim).
 */
export interface CtxOptions {
  readonly mode?: Mode;
  readonly seed?: number;
  readonly storage?: KeyValueStorage;
  readonly schedule?: Schedule;
}
