import type { Schema } from "@keel/schema";
import { heldMap } from "@keel/schema/internal";

/** Each store's transactions by name with their payload schemas, filled by `store` (k.compat Surface, `storeShapes`). */
export const storePayloads = heldMap<object, ReadonlyMap<string, Schema<unknown>>>();
