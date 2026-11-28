import { defect } from "@keel/schema";
import { Duration } from "./Duration.schema.ts";
import { durationText } from "./internal/durationText.ts";

/** The duration of `ms` milliseconds (std.temporal). Any `ms` that is not an integer within 1e15 either way raises a defect, as `encode` of an invalid value does. */
export function durationOf(ms: number): Duration {
  const r = Duration.parse(Number.isInteger(ms) ? durationText(ms) : "");
  return r.ok
    ? r.value
    : defect("durationOf: ms is not an integer number of milliseconds within 1e15", {
        data: { ms: String(ms) },
        cause: r.error,
      });
}
