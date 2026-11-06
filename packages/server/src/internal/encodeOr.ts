import { type JsonValue, type Schema, attempt } from "@keel/schema";

/** `value` encoded by `schema` for island props; `{}` when there is no schema or it does not encode. */
export function encodeOr(schema: Schema<unknown> | undefined, value: unknown): JsonValue {
  if (schema === undefined) return {};
  const r = attempt(() => schema.encode(value));
  return r.ok ? r.value : {};
}
