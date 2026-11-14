import type { Field } from "./Field.ts";

/** A table's query as the route's `search` holds it: what `tableSearch` parses. */
export type TableQuery<T, S extends Field<T>, F extends Field<T>> = {
  sort?: S;
  dir?: "asc" | "desc";
  page?: number;
  q?: string;
} & { [K in F]?: T[K] };
