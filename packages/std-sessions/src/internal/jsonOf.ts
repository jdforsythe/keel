import { type JsonValue, type Schema, attempt, s } from "@keel/schema";

const json = s.json();

/**
 * `value` as JSON (std.sessions): with `schema`, as it encodes it (so no undeclared key of an open object is kept),
 * and `null` when it does not encode; without one, `value` itself when it is plain data, else `null`.
 */
export function jsonOf(value: unknown, schema?: Schema<unknown, boolean>): JsonValue {
  if (schema !== undefined) {
    const r = attempt(() => schema.encode(value));
    return r.ok ? r.value : null;
  }
  const r = json.parse(value);
  return r.ok ? r.value : null;
}
