import type { Schema } from "./Schema.ts";
import { kernelSet } from "./internal/kernelSet.ts";

/** Whether `x` is a schema `s` built in this realm (k.identity): read from the kernel's record, never from a property. */
export function isSchema(x: unknown): x is Schema<unknown> {
  return typeof x === "object" && x !== null && kernelSet("schema").has(x);
}
