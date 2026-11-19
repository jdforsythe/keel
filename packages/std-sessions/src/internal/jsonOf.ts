import { type JsonValue, type Schema, attempt, s } from "@keel/schema";

const json = s.json();

/** `value` as JSON: encoded by `schema` when given and it fits, else `value` itself when it is JSON, else null. */
export function jsonOf(value: unknown, schema?: Schema<unknown, boolean>): JsonValue {
  if (schema !== undefined) {
    const r = attempt(() => schema.encode(value));
    if (r.ok) return r.value;
  }
  const r = json.parse(value);
  return r.ok ? r.value : null;
}
