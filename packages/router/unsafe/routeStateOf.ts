import type { Table } from "../src/internal/Table.ts";
import { isRouteStateOf } from "../src/internal/isRouteStateOf.ts";
import { unsafe } from "./unsafe.ts";

/** `x` as the table's typed state `S` when it is a route state built from a match in `table`, else `undefined`. */
export function routeStateOf<S>(table: Table, x: unknown): S | undefined {
  if (!isRouteStateOf(table, x)) return undefined;
  return unsafe(
    "createRouterWith builds the state from a match in this table, its id just checked against the table, and its params and search were parsed by that page's schemas at match time",
    () => x as S,
  );
}
