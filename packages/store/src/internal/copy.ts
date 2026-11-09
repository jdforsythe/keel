import type { Result, Schema, SchemaError } from "@keel/schema";
import { graft } from "./graft.ts";

/**
 * Validate `value` and return a fresh copy made by the schema's own codec, with every `s.secret` value kept (rfc:0071):
 * in memory a payload or state may hold secrets. `persisted` is the copy for what leaves the store.
 */
export function copy<T>(schema: Schema<T>, value: unknown): Result<T, SchemaError> {
  const parsed = schema.parse(value);
  return parsed.ok ? schema.parse(graft(schema.encode(parsed.value), parsed.value)) : parsed;
}
