import { type Locale, collate } from "@keel/std-i18n";
import type { Columns } from "../Columns.type.ts";
import type { Field } from "../Field.ts";
import { fieldsOf } from "./fieldsOf.ts";

const sign = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);

/**
 * The ascending order of rows by `field`: `compare` when given, else by kind (`text` by `collate` in `locale`, `number`
 * numerically, `enum` in declaration order, `boolean` false first). Values of another type compare equal.
 */
export function compareBy<T, S extends Field<T>, F extends Field<T>>(
  cols: Columns<T, S, F>,
  field: S,
  locale: Locale,
): (a: T, b: T) => number {
  const custom = cols.compare[field];
  if (custom !== undefined) return (a, b) => sign(custom(a, b));
  const kind = cols.kinds[field];
  const node = fieldsOf(cols.row.node)[field];
  const values: readonly string[] = node?.kind === "enum" ? node.values : [];
  return (a, b) => {
    const x: unknown = a[field];
    const y: unknown = b[field];
    if (kind === "text" && typeof x === "string" && typeof y === "string") return sign(collate(x, y, locale));
    if (kind === "number" && typeof x === "number" && typeof y === "number") return sign(x - y);
    if (kind === "boolean" && typeof x === "boolean" && typeof y === "boolean") return Number(x) - Number(y);
    if (kind === "enum" && typeof x === "string" && typeof y === "string")
      return sign(values.indexOf(x) - values.indexOf(y));
    return 0;
  };
}
