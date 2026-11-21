import type { JsonValue, Schema } from "@keel/schema";
import { attempted } from "./attempted.ts";

/** `value` encoded by `schema` for island props; `{}` when there is no schema or it does not encode. */
export function encodeOr(schema: Schema<unknown> | undefined, value: unknown): JsonValue {
  if (schema === undefined) return {};
  const r = attempted(() => schema.encode(value));
  return r.ok ? r.value : {};
}
