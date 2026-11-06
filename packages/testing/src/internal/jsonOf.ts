import type { Schema } from "@keel/schema";

/** `value` as compact JSON through `schema.encode`, falling back to plain `JSON.stringify`. */
export function jsonOf<T>(schema: Schema<T>, value: T): string {
  try {
    return JSON.stringify(schema.encode(value));
  } catch {
    return JSON.stringify(value) ?? String(value);
  }
}
