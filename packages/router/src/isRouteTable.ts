import { records } from "./internal/records.ts";
import type { RouteTable } from "./types/RouteTable.ts";

/**
 * Whether `x` is a route table `manifest` or `routeTable` made in this realm (k.identity), read from the router's
 * record, never from a property: a spread, a copy or a `Proxy` of one is none.
 */
export function isRouteTable(x: unknown): x is RouteTable {
  return typeof x === "object" && x !== null && records.routeTable.has(x);
}
