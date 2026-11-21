import type { ObjectSchema } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** The search schema `tableSearch` built field by field, typed as the query its columns describe. */
export function asQuerySchema<Q>(x: ObjectSchema<unknown>): ObjectSchema<Q> {
  return unsafe(
    "built from the columns: sort is s.enum(sort), filters rebuild their enum or boolean field, every key optional",
    () => x as ObjectSchema<Q>,
  );
}
