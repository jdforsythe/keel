import { type Result, err, ok } from "@keel/schema";
import { Instant } from "./Instant.schema.ts";
import type { TemporalError } from "./TemporalError.ts";
import { iso } from "./internal/iso.ts";

/**
 * The instant `Math.floor(ms)` milliseconds after 1970-01-01T00:00:00.000Z (std.temporal). Reads no clock: the current
 * instant is `instantOf(ctx.clock.now())`. A non-finite `ms` or one outside years 0001 to 9999 is `temporal.outOfRange`.
 */
export function instantOf(ms: number): Result<Instant, TemporalError> {
  const r = Instant.parse(iso(Math.floor(ms)));
  if (r.ok) return ok(r.value);
  return err({ code: "temporal.outOfRange", message: `${ms} ms is outside years 0001 to 9999`, data: { value: ms } });
}
