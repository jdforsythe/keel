import type { JsonValue, Schema } from "@keel/schema";

/**
 * A statement made by `sql(schema)` (std.postgres): `text` with `$1`, `$2`, ... in template order, `params` the values
 * they stand for, and the schema every row it returns is parsed with.
 */
export type Query<T> = {
  readonly text: string;
  readonly params: readonly JsonValue[];
  readonly schema: Schema<T, boolean>;
};
