import { type PlainDate, UTC, instantOf, plainDateOf } from "@keel/std-temporal";

/** The UTC calendar day of `ms` epoch milliseconds; `null` outside years 0001 to 9999. */
export function dayOf(ms: number): PlainDate | null {
  const at = instantOf(ms);
  return at.ok ? plainDateOf(at.value, UTC) : null;
}
