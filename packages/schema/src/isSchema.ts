import type { Schema } from "./Schema.ts";
import { SCHEMA_KEY } from "./internal/SCHEMA_KEY.ts";

/** Whether `x` is a schema `s` built (k.schema Guard): a key guard on `Symbol.for('keel.schema')`. */
export function isSchema(x: unknown): x is Schema<unknown> {
  return typeof x === "object" && x !== null && Object.hasOwn(x, SCHEMA_KEY);
}
