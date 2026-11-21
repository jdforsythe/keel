import type { SchemaError } from "@keel/schema";
import type { InvalidValueError } from "../types/InvalidValueError.ts";

/** `error` (or, without one, an empty `schema.invalid` saying why) with `data.at` the host element's id. */
export function invalidOf(at: string, error: SchemaError | string): InvalidValueError {
  if (typeof error === "string") return { code: "schema.invalid", message: error, data: { issues: [], at } };
  return { ...error, data: { ...error.data, at } };
}
