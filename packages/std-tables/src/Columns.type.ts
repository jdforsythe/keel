import type { ObjectSchema } from "@keel/schema";
import type { ColumnKind } from "./ColumnKind.ts";
import type { Field } from "./Field.ts";

/** A checked table definition from `columns`: the row schema, its field lists and each field's kind. */
export type Columns<T, S extends Field<T>, F extends Field<T>> = {
  readonly row: ObjectSchema<T>;
  readonly key: Field<T, string | number>;
  readonly rowHeader: Field<T>;
  readonly show: readonly Field<T>[];
  readonly sort: readonly S[];
  readonly search: readonly Field<T, string>[];
  readonly filter: readonly F[];
  /** One kind per field of `row`. */
  readonly kinds: Readonly<Record<string, ColumnKind>>;
  /** The `compare` entries as row orders, by field. */
  readonly compare: Readonly<Record<string, (a: T, b: T) => number>>;
};
