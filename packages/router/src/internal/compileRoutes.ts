import type { RouteTable } from "../types/RouteTable.ts";
import type { Compiled } from "./Compiled.ts";
import { codedError } from "./codedError.ts";
import { tables } from "./tables.ts";

/**
 * The compiled form of a route table `manifest` or `routeTable` made (k.routes): its bindings, its routes by id and
 * its routes with a path, each with its chain, for matching. A module's table whose chain names a layout of another
 * module, served without that module's table, throws E1506 unless `open` is `"allow"` (a reader of the bindings
 * alone, such as `routesArtifact`). Any other value, a copy of a table among them (k.identity), throws E1515 naming `routes`.
 */
export function compileRoutes(routes: RouteTable, open: "allow" | "refuse" = "refuse"): Compiled {
  const c = tables.get(routes);
  if (c === undefined)
    throw codedError(
      "E1515",
      "routes: no route table manifest(...) or routeTable(...) returned; pass that value itself",
    );
  if (c.open !== undefined && open === "refuse") throw codedError("E1506", c.open);
  return c;
}
