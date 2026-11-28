import type { Instant } from "./Instant.schema.ts";

/** Milliseconds from 1970-01-01T00:00:00.000Z to `i` (std.temporal); the inverse of `instantOf`. */
export function epochMs(i: Instant): number {
  return Date.parse(i);
}
