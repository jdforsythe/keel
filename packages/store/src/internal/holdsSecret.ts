import type { Schema } from "@keel/schema";

const MARKER = "[secret]";

const marked = (encoded: unknown, value: unknown): boolean => {
  if (encoded === MARKER) return typeof value === "object" && value !== null;
  if (typeof encoded !== "object" || encoded === null || typeof value !== "object" || value === null) return false;
  return Object.entries(encoded).some(([k, e]) => marked(e, Reflect.get(value, k)));
};

/** Whether `value`, valid under `schema`, holds an `s.secret` value (its encoding writes the marker there; rfc:0071). */
export function holdsSecret(schema: Schema<unknown> | undefined, value: unknown): boolean {
  return schema !== undefined && marked(schema.encode(value), value);
}
