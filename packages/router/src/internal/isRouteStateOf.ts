import type { Table } from "./Table.ts";

/** Whether `x` is a route state built from a match in `table`: its id is null or an id of the table. */
export function isRouteStateOf(table: Table, x: unknown): boolean {
  if (typeof x !== "object" || x === null || !("id" in x) || !("pending" in x)) return false;
  return x.id === null || (typeof x.id === "string" && table.has(x.id));
}
