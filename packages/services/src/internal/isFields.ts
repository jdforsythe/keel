import type { JsonValue } from "@keel/schema";

/** True when an encoded value is a JSON object (not null, not an array). */
export function isFields(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
