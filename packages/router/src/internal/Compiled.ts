import type { Bound } from "./Bound.ts";
import type { Located } from "./Located.ts";
import type { Table } from "./Table.ts";

/**
 * What a route table compiles to when it is made: bindings, routes by id, and the routes with a path for matching.
 * `open` is set on a module's table whose chain names a layout of another module: the E1506 message naming the
 * first such binding and layout; the table serves only once `routeTable` joins it with that module's (E1506 otherwise, `compileRoutes`).
 */
export type Compiled = {
  readonly bindings: ReadonlyMap<string, Bound>;
  readonly table: Table;
  readonly located: readonly Located[];
  readonly open?: string;
};
