import { type JsonValue, type Schema, s } from "@keel/schema";

const json = s.json();

/**
 * `value` as JSON (std.sessions): with `schema`, as it encodes the parsed value (so no undeclared key of an open object
 * is kept), and `null` when it does not parse; without one, `value` itself when it is plain data, else `null`. `parse`
 * never throws and `encode` refuses only what `parse` refuses; what the value itself throws while it is read (a
 * `Proxy`'s `get` trap) passes on.
 */
export function jsonOf(value: unknown, schema?: Schema<unknown, boolean>): JsonValue {
  if (schema !== undefined) {
    const parsed = schema.parse(value);
    return parsed.ok ? schema.encode(parsed.value) : null;
  }
  const r = json.parse(value);
  return r.ok ? r.value : null;
}
