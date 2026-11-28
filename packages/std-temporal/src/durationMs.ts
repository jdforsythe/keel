import type { Duration } from "./Duration.schema.ts";
import { durationValue } from "./internal/durationValue.ts";

/** The milliseconds `d` spans, negative for a negative duration (std.temporal); the inverse of `durationOf`. */
export function durationMs(d: Duration): number {
  return durationValue(d);
}
