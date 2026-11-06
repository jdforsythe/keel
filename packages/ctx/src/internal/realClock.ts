import type { Clock } from "../Clock.ts";

/** Wall clock. One of the few places allowed to read Date.now (k.ctx). */
export function realClock(): Clock {
  return { now: () => Date.now() };
}
