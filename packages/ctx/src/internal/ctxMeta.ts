import type { Ctx } from "../Ctx.ts";
import type { Mode } from "../Mode.ts";

/** Mode and seed of every ctx made by createCtx; registered capabilities build lazily from it. Not a ctx property, so a ctx stays plain data. */
export const ctxMeta: WeakMap<Ctx, { readonly mode: Mode; readonly seed: number }> = new WeakMap();
