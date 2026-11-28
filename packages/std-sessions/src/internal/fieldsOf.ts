import type { JsonValue } from "@keel/schema";
import type { JsonObject } from "./JsonObject.ts";

/** A copy of `v`'s entries when it is a JSON object (no array, no `null`), else `undefined`. */
export function fieldsOf(v: JsonValue): JsonObject | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  return Object.fromEntries(Object.entries(v));
}
