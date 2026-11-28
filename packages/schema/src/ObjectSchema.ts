import type { PiiClass } from "./PiiClass.ts";
import type { Result } from "./Result.ts";
import type { Schema } from "./Schema.ts";
import type { SchemaError } from "./SchemaError.ts";
import type { StringInput } from "./StringInput.ts";

/** The schema returned by `s.object`: a `Schema` that can also decode string input (forms, URL params). */
export interface ObjectSchema<T> extends Schema<T> {
  /** Coerce string input (numbers, booleans, repeated keys, dotted keys) then validate; see k.schema. */
  decodeStrings(input: StringInput): Result<T, SchemaError>;
  pii(cls: PiiClass): ObjectSchema<T>;
}
