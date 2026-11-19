import type { JsonValue } from "@keel/schema";

/** A value with no schema, redacted (std.sessions `el:`, `error:`): a string becomes `x` repeated, a number 0, a boolean false, anything else null. */
export function mask(value: JsonValue): JsonValue {
  if (typeof value === "string") return "x".repeat(value.length);
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return null;
}
