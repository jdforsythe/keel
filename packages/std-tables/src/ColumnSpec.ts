import type { Field } from "./Field.ts";

/** What `columns(row, spec)` reads: the field lists of a table over rows `T` (std.tables Columns). */
export type ColumnSpec<T, S extends Field<T>, F extends Field<T>, W extends Field<T>> = {
  /** A `text` or `number` field unique per row. */
  readonly key: Field<T, string | number>;
  /** Rendered as `th scope=row`; default the first of `show`. */
  readonly rowHeader?: W;
  readonly show: readonly W[];
  readonly sort?: readonly S[];
  readonly search?: readonly Field<T, string>[];
  readonly filter?: readonly F[];
  /** The order of a sort column; required for a `value` column. */
  readonly compare?: { readonly [K in Field<T>]?: (a: T[K], b: T[K]) => number };
};
