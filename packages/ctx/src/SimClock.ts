import type { Clock } from "./Clock.ts";

/** Simulated clock: starts at 0 and moves only through `advance(ms)`. */
export interface SimClock extends Clock {
  advance(ms: number): void;
}
