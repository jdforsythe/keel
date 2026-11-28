import { s } from "@keel/schema";
import { isInstant } from "./internal/isInstant.ts";
import { iso } from "./internal/iso.ts";

/**
 * A UTC instant to the millisecond, `YYYY-MM-DDTHH:mm:ss.sssZ` in years 0001 to 9999, as `Date.prototype.toISOString`
 * writes it (std.temporal); registered as `temporal.Instant`. String order is time order; `encode` is the identity.
 */
export const Instant = s.format("temporal.Instant", s.string(), {
  check: isInstant,
  gen: { from: s.int({ min: -62135596800000, max: 253402300799999 }), map: iso },
});
export type Instant = s.infer<typeof Instant>;

s.register("temporal.Instant", Instant);
