import type { Clock } from "./Clock.ts";

/** Simulated clock: starts at 0 and moves only through `advance(ms)`. `next()` is the earliest pending `after` deadline, else null. */
export interface SimClock extends Clock {
  advance(ms: number): void;
  next(): number | null;
}
