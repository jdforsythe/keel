import type { Schema } from "@keel/schema";

/** Each store's transactions by name with their payload schemas, filled by `store` (k.compat Surface, `storeShapes`). */
export const storePayloads = new WeakMap<object, ReadonlyMap<string, Schema<unknown>>>();
