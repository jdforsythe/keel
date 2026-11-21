import type { Table } from "./Table.ts";

/**
 * Narrow a route state built from a match in `table` to the table's typed state `S`: its id is null or an id of the
 * table. Params and search were parsed by that page's own schemas at match time.
 */
export function isRouteStateOf<S>(table: Table, x: unknown): x is S {
  if (typeof x !== "object" || x === null || !("id" in x) || !("pending" in x)) return false;
  return x.id === null || (typeof x.id === "string" && table.has(x.id));
}
