import type { RouteTable } from "../types/RouteTable.ts";
import type { Compiled } from "./Compiled.ts";
import { codedError } from "./codedError.ts";
import { tables } from "./tables.ts";

/**
 * The compiled form of a route table `manifest` or `routeTable` made (k.routes): its bindings, its routes by id and
 * its routes with a path, each with its chain, for matching. A module's table whose chain names a layout of another
 * module, served without that module's table, throws E1506; anything else throws a TypeError.
 */
export function compileRoutes(routes: RouteTable): Compiled {
  const c = tables.get(routes);
  if (c === undefined) throw new TypeError("not a route table: pass a manifest(...) or routeTable(...) value");
  if (c.open !== undefined) throw codedError("E1506", c.open);
  return c;
}
