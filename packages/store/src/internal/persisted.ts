import type { Result, Schema, SchemaError } from "@keel/schema";

/**
 * Validate `value` and return the copy a snapshot writes: encoded and parsed back, so an `s.secret` value (encoded as
 * `"[secret]"`) fails with `secret-missing` rather than leave the store (rfc:0071).
 */
export function persisted<T>(schema: Schema<T>, value: unknown): Result<T, SchemaError> {
  const parsed = schema.parse(value);
  return parsed.ok ? schema.parse(schema.encode(parsed.value)) : parsed;
}
