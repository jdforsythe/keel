import { kernelSet } from "@keel/schema/internal";
import type { RouteTable } from "./types/RouteTable.ts";

/**
 * Whether `x` is a route table `manifest` or `routeTable` made in this realm (k.identity), read from the kernel's
 * record, never from a property: a spread, a copy or a `Proxy` of one is none.
 */
export function isRouteTable(x: unknown): x is RouteTable {
  return typeof x === "object" && x !== null && kernelSet("router.routeTable").has(x);
}
