import type { SimClock } from "../SimClock.ts";

/** Simulated clock at 0. `advance` rejects negative or non-finite ms so time stays monotonic. */
export function simClock(): SimClock {
  let t = 0;
  return {
    now: () => t,
    advance: (ms) => {
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`advance(ms) needs a finite ms >= 0, got ${ms}`);
      t += ms;
    },
  };
}
