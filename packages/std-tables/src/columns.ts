import { type ObjectSchema, defect, piiPaths } from "@keel/schema";
import type { ColumnKind } from "./ColumnKind.ts";
import type { ColumnSpec } from "./ColumnSpec.ts";
import type { Columns } from "./Columns.type.ts";
import type { Field } from "./Field.ts";
import { fieldsOf } from "./internal/fieldsOf.ts";
import { kindOf } from "./internal/kindOf.ts";

/**
 * A table over rows of the `s.object` schema `row` (std.tables Columns). Each field's kind comes from its schema;
 * `key` is `text` or `number`, `search` columns are `text`, `filter` columns `enum` or `boolean`, and a `value`
 * column sorts only through `compare`. Throws E2851 for an entry naming no field or a field of the wrong kind.
 */
export function columns<
  T,
  const W extends Field<T>,
  const S extends Field<T> = never,
  const F extends Field<T, string | boolean> = never,
>(row: ObjectSchema<T>, spec: ColumnSpec<T, S, F, W>): Columns<T, S, F, W> {
  const fields = fieldsOf(row.node);
  const kinds: Record<string, ColumnKind> = {};
  for (const [name, node] of Object.entries(fields)) kinds[name] = kindOf(node);
  const kind = (list: string, name: string): ColumnKind =>
    kinds[name] ?? defect("a column names no field of the row", { code: "E2851", data: { list, name } });
  const expect = (list: string, names: readonly string[], ok: readonly ColumnKind[], what: string): void => {
    for (const name of names) {
      const k = kind(list, name);
      if (!ok.includes(k))
        defect("a column is of a kind its list does not take", {
          code: "E2851",
          data: { list, name, kind: k, takes: what },
        });
    }
  };
  const show = spec.show;
  const rowHeader = spec.rowHeader ?? show[0] ?? defect("show names no column", { code: "E2851" });
  expect("key", [spec.key], ["text", "number"], "text or number");
  // The key is written into every row's element ids.
  const mark = piiPaths(row).find((m) => m.path === spec.key || m.path.startsWith(`${spec.key}.`));
  if (mark !== undefined)
    defect("the key is personal; keys become element ids", {
      code: "E2851",
      data: { key: spec.key, class: mark.class },
    });
  expect("show", show, ["text", "number", "enum", "boolean", "value"], "any field");
  kind("rowHeader", rowHeader);
  if (!show.includes(rowHeader)) defect("rowHeader is not in show", { code: "E2851", data: { rowHeader } });
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
    else if (kind("sort", name) === "value")
      defect("a value column in sort needs compare", { code: "E2851", data: { name } });
  };
  for (const name of sort) order(name);
  return { row, key: spec.key, rowHeader, show, sort, search, filter, kinds, compare };
}
