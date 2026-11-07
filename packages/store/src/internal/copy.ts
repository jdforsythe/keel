import type { Result, Schema, SchemaError } from "@keel/schema";

/** Validate `value` and return a fresh JSON-safe copy made by the schema's own codec. */
export function copy<T>(schema: Schema<T>, value: unknown): Result<T, SchemaError> {
  const parsed = schema.parse(value);
  return parsed.ok ? schema.parse(schema.encode(parsed.value)) : parsed;
}
