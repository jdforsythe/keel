import type { ObjectSchema } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** The search schema `tableSearch` built field by field, typed as the query its columns describe. */
export function asQuerySchema<Q>(x: ObjectSchema<unknown>): ObjectSchema<Q> {
  return unsafe(
    "tableSearch builds it from the columns of Q alone: sort as s.enum of the sortable keys, each filter its enum or boolean field, every key optional",
    () => x as ObjectSchema<Q>,
  );
}
