import type { Field } from "../Field.ts";
import type { TableQuery } from "../TableQuery.ts";

/** `search` with `q` (absent when empty) and no `page`: where a `TableSearch` navigates. */
export function withQuery<T, S extends Field<T>, F extends Field<T>>(
  search: TableQuery<T, S, F>,
  q: string,
): TableQuery<T, S, F> {
  const out = { ...search, q };
  Reflect.deleteProperty(out, "page");
  if (q === "") Reflect.deleteProperty(out, "q");
  return out;
}
