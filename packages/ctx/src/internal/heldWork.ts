import { heldOf } from "./heldOf.ts";

/** The labels of the work a sim ctx's family holds now, in hold order (k.sim); read by `simulate`'s drive. */
export function heldWork(ctx: { readonly clock: object }): readonly string[] {
  return heldOf(ctx.clock).map((h) => h.label);
}
