import { s } from "@keel/schema";
import { durationText } from "./internal/durationText.ts";
import { durationValue } from "./internal/durationValue.ts";

/**
 * Elapsed whole milliseconds, at most 1e15 either way, in one canonical ISO 8601 text (std.temporal): `PT0S`, `PT1H30M`,
 * `-PT0.500S`; no days, months or years. Registered as `temporal.Duration`.
 */
export const Duration = s.format("temporal.Duration", s.string(), {
  check: (v) => {
    const ms = durationValue(v);
    return Math.abs(ms) <= 1e15 && durationText(ms) === v;
  },
  gen: { from: s.int({ min: -1e15, max: 1e15 }), map: durationText },
});
export type Duration = s.infer<typeof Duration>;

s.register("temporal.Duration", Duration);
