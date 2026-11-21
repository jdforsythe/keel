import type { Contract } from "../contract/types/Contract.ts";

/**
 * A deployable's route table (k.routes Union): the contracts it serves, from `routeTable(...tables)` or one module's
 * `manifest`. Its bindings are no public member; ids, paths, methods and schemas are its contracts' `entries`.
 */
export interface RouteTable {
  readonly kind: "keel.routeTable";
  readonly contracts: readonly Contract[];
}
