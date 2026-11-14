import type { ObjectSchema } from "@keel/schema";
import type { ColumnKind } from "./ColumnKind.ts";
import type { ColumnSpec } from "./ColumnSpec.ts";
import type { Columns } from "./Columns.type.ts";
import type { Field } from "./Field.ts";
import { fieldsOf } from "./internal/fieldsOf.ts";
import { kindOf } from "./internal/kindOf.ts";

const fail = (message: string): never => {
  throw new Error(`E2851 ${message}`);
};

/**
 * A table over rows of the `s.object` schema `row` (std.tables Columns). Each field's kind comes from its schema;
 * `key` is `text` or `number`, `search` columns are `text`, `filter` columns `enum` or `boolean`, and a `value`
 * column sorts only through `compare`. Throws E2851 for an entry naming no field or a field of the wrong kind.
 */
export function columns<T, const S extends Field<T> = never, const F extends Field<T, string | boolean> = never>(
  row: ObjectSchema<T>,
  spec: ColumnSpec<T, S, F>,
): Columns<T, S, F> {
  const fields = fieldsOf(row.node);
  const kinds: Record<string, ColumnKind> = {};
  for (const [name, node] of Object.entries(fields)) kinds[name] = kindOf(node);
  const kind = (list: string, name: string): ColumnKind =>
    kinds[name] ?? fail(`${list} names ${JSON.stringify(name)}, which is not a field of the row`);
  const expect = (list: string, names: readonly string[], ok: readonly ColumnKind[], what: string): void => {
    for (const name of names) {
      const k = kind(list, name);
      if (!ok.includes(k)) fail(`${list} column ${name} is a ${k} column; ${list} takes ${what}`);
    }
  };
  const show = spec.show;
  const rowHeader = spec.rowHeader ?? show[0] ?? fail("show names no column");
  expect("key", [spec.key], ["text", "number"], "text or number");
  expect("show", show, ["text", "number", "enum", "boolean", "value"], "any field");
  kind("rowHeader", rowHeader);
  if (!show.includes(rowHeader)) fail(`rowHeader ${rowHeader} is not in show`);
  const sort = spec.sort ?? [];
  const search = spec.search ?? [];
  const filter = spec.filter ?? [];
  expect("search", search, ["text"], "text");
  expect("filter", filter, ["enum", "boolean"], "enum or boolean");
  const compare: Record<string, (a: T, b: T) => number> = {};
  const given = spec.compare;
  for (const name of Object.keys(given ?? {})) kind("compare", name);
  const order = <K extends Field<T>>(name: K): void => {
    const fn = given?.[name];
    if (fn !== undefined) compare[name] = (a, b) => fn(a[name], b[name]);
    else if (kind("sort", name) === "value") fail(`${name} is a value column; sort needs compare.${name}`);
  };
  for (const name of sort) order(name);
  return { row, key: spec.key, rowHeader, show, sort, search, filter, kinds, compare };
}
