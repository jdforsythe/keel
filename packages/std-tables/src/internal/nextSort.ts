import type { Field } from "../Field.ts";
import type { TableQuery } from "../TableQuery.ts";

/** A sort link's search: the same search sorted by `col`, `desc` when already `asc` on it, else `asc`, and no `page`. */
export function nextSort<T, S extends Field<T>, F extends Field<T>>(
  search: TableQuery<T, S, F>,
  col: S,
): TableQuery<T, S, F> {
  const out = { ...search, sort: col, dir: search.sort === col && search.dir !== "desc" ? "desc" : "asc" };
  Reflect.deleteProperty(out, "page");
  return out;
}
