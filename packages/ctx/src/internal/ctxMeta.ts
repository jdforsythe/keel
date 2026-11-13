import type { Ctx } from "../Ctx.ts";
import type { Mode } from "../Mode.ts";
import type { Schedule } from "../Schedule.schema.ts";

/**
 * Mode and seed of every ctx made by createCtx; registered capabilities build lazily from it. Not a ctx property, so a
 * ctx stays plain data. `given` is the seed passed to createCtx, `undefined` when none was (`seedOf`). `plans` are the
 * schedule's capability plans (sim).
 */
export const ctxMeta: WeakMap<
  Ctx,
  { readonly mode: Mode; readonly seed: number; readonly given: number | undefined; readonly plans: Schedule["plans"] }
> = new WeakMap();
