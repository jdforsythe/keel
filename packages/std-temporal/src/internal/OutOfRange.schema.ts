import { s } from "@keel/schema";

/** `temporal.outOfRange` (std.temporal): the input or the result is outside years 0001 to 9999; `value` the input. */
export const OutOfRange = s.error("temporal.outOfRange", s.object({ value: s.number() }));
