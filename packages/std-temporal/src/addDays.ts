import { type Result, err, ok } from "@keel/schema";
import { PlainDate } from "./PlainDate.schema.ts";
import type { TemporalError } from "./TemporalError.ts";
import { iso } from "./internal/iso.ts";

/** `d` moved by `days` calendar days (std.temporal). A non-integer `days`, or a result outside years 0001 to 9999, is `temporal.outOfRange`. */
export function addDays(d: PlainDate, days: number): Result<PlainDate, TemporalError> {
  const r = PlainDate.parse(Number.isInteger(days) ? iso(Date.parse(d) + days * 864e5).slice(0, 10) : "");
  if (r.ok) return ok(r.value);
  const message = `${d} plus ${days} days is outside years 0001 to 9999`;
  return err({ code: "temporal.outOfRange", message, data: { value: days } });
}
