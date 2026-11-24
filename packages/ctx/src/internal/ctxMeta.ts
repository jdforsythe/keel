import type { Ctx } from "../Ctx.ts";
import type { Mode } from "../Mode.ts";
import type { Schedule } from "../Schedule.schema.ts";
import { realmShared } from "./realmShared.ts";

/**
 * Mode and seed of every ctx made by createCtx; registered capabilities build lazily from it. Not a ctx property, so a
 * ctx stays plain data. `given` is the seed passed to createCtx, `undefined` when none was (`seedOf`). `plans` are the
 * schedule's capability plans (sim). `root` is the ctx a replica was made from: it builds nothing, its capabilities are the root's. Shared by every copy of this module in the realm (`realmShared`), so a fresh module
 * graph's capabilities build on a ctx the test made.
 */
export const ctxMeta: WeakMap<
  Ctx,
  { readonly mode: Mode; readonly seed: number; readonly given: number | undefined; readonly plans: Schedule["plans"]; readonly root?: Ctx }
> = realmShared("keel.ctxMeta");
