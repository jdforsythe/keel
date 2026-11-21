import type { KeelError } from "@keel/schema";

/** Why `instantOf` or `addDays` failed (std.temporal): the input or the result is outside years 0001 to 9999. */
export type TemporalError = KeelError<"temporal.outOfRange", { readonly value: number }>;
