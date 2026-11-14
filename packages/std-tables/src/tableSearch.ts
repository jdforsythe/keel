import { type ObjectSchema, type Schema, piiPaths, s } from "@keel/schema";
import { asQuerySchema } from "../unsafe/asQuerySchema.ts";
import type { Columns } from "./Columns.type.ts";
import type { Field } from "./Field.ts";
import type { TableQuery } from "./TableQuery.ts";
import { fieldsOf } from "./internal/fieldsOf.ts";

const RESERVED: readonly string[] = ["sort", "dir", "page", "q"];
const made = new WeakMap<object, ObjectSchema<unknown>>();

const fail = (message: string): never => {
  throw new Error(`E2852 ${message}`);
};

function filterSchema(node: Schema<unknown>["node"] | undefined): Schema<unknown, true> {
  if (node?.kind === "boolean") return s.boolean().optional();
  const [first, ...rest] = node?.kind === "enum" ? node.values : [];
  return first === undefined ? fail("filter column is not an enum or boolean") : s.enum([first, ...rest]).optional();
}

/**
 * The route `search` schema of a table's query (std.tables Query), every key optional: `sort`, `dir`, `page`, `q`
 * (with `search` columns) and each filter column under its own name. One schema per `cols`. Throws E2852 for a
 * filter column named `sort`, `dir`, `page` or `q`, and for a `.pii()` search or filter column: the query is in
 * the URL.
 */
export function tableSearch<T, S extends Field<T>, F extends Field<T>>(
  cols: Columns<T, S, F>,
): ObjectSchema<TableQuery<T, S, F>> {
  const seen = made.get(cols);
  if (seen !== undefined) return asQuerySchema(seen);
  for (const name of cols.filter)
    if (RESERVED.includes(name)) fail(`filter column ${name} collides with the table query`);
  const marked = piiPaths(cols.row);
  const personal = (list: string, names: readonly string[]): void => {
    for (const name of names) {
      const hit = marked.find((m) => m.path === name || m.path.startsWith(`${name}.`));
      if (hit !== undefined) fail(`${list} column ${name} is personal (${hit.class}); the query travels in the URL`);
    }
  };
  personal("search", cols.search);
  personal("filter", cols.filter);
  const fields = fieldsOf(cols.row.node);
  const shape: Record<string, Schema<unknown, true>> = {};
  const [first, ...rest] = cols.sort;
  if (first !== undefined) shape.sort = s.enum([first, ...rest]).optional();
  shape.dir = s.enum(["asc", "desc"]).optional();
  shape.page = s.int({ min: 1 }).optional();
  if (cols.search.length > 0) shape.q = s.string({ max: 200 }).optional();
  for (const name of cols.filter) shape[name] = filterSchema(fields[name]);
  const schema = s.object(shape);
  made.set(cols, schema);
  return asQuerySchema(schema);
}
