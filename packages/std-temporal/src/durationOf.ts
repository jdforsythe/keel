import { notDuration } from "../unsafe/notDuration.ts";
import { Duration } from "./Duration.schema.ts";
import { durationText } from "./internal/durationText.ts";

/** The duration of `ms` milliseconds (std.temporal). Any `ms` that is not an integer within 1e15 either way throws, as `encode` of an invalid value does. */
export function durationOf(ms: number): Duration {
  const r = Duration.parse(Number.isInteger(ms) ? durationText(ms) : "");
  return r.ok ? r.value : notDuration(ms);
}
