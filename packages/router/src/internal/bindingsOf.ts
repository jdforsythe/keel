import type { RouteTable } from "../types/RouteTable.ts";
import type { Bound } from "./Bound.ts";
import { codedError } from "./codedError.ts";
import { tables } from "./tables.ts";

/**
 * Each id of route table `routes` to its contract, entry and binding (k.routes Union), for kernel code: the server,
 * the compiler and the harness. Not public: code outside the kernel reads a table's contracts. Any other value is E1515.
 */
export function bindingsOf(routes: RouteTable): ReadonlyMap<string, Bound> {
  const c = tables.get(routes);
  if (c === undefined)
    throw codedError(
      "E1515",
      "routes: no route table manifest(...) or routeTable(...) returned; pass that value itself",
    );
  return c.bindings;
}
