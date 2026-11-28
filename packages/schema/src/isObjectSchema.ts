import type { ObjectSchema } from "./ObjectSchema.ts";
import { records } from "./internal/records.ts";

/** Whether `x` is a schema `s.object` built in this realm (k.identity), read from the kernel's record. */
export function isObjectSchema(x: unknown): x is ObjectSchema<unknown> {
  return typeof x === "object" && x !== null && records.objectSchema.has(x);
}
