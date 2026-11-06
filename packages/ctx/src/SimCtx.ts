import type { Ctx } from "./Ctx.ts";
import type { SimClock } from "./SimClock.ts";
import type { SimNet } from "./SimNet.ts";

/** A ctx in sim mode: the clock and net expose their simulation controls. */
export interface SimCtx extends Ctx {
  readonly clock: SimClock;
  readonly net: SimNet;
}
