import type { JsonValue } from "@keel/schema";
import type { JsonObject } from "./JsonObject.ts";

/** `v` when it is a JSON object, else `{}`. */
export function objectOf(v: JsonValue): JsonObject {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, JsonValue> = {};
  for (const [k, x] of Object.entries(v)) out[k] = x;
  return out;
}
