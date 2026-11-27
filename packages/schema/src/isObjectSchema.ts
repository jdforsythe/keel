import type { ObjectSchema } from "./ObjectSchema.ts";
import { kernelSet } from "./internal/kernelSet.ts";

/** Whether `x` is a schema `s.object` built in this realm (k.identity), read from the kernel's record. */
export function isObjectSchema(x: unknown): x is ObjectSchema<unknown> {
  return typeof x === "object" && x !== null && kernelSet("objectSchema").has(x);
}
