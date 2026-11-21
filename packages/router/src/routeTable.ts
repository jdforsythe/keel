import { tables } from "./internal/tables.ts";
import { unionTables } from "./internal/unionTables.ts";
import type { RouteTable } from "./types/RouteTable.ts";

/**
 * A deployable's route table (k.routes Union): the union of `tables`, each a module's `manifest` or a route table
 * (nested tables flatten), the contracts in argument order. Throws E1502 for one module twice or a path pattern two
 * modules share at any method, E1509 for a k.prefix collision over the union. Returns a frozen `{ kind:
 * 'keel.routeTable', contracts }`; argument order changes no answer.
 */
export function routeTable(...parts: readonly RouteTable[]): RouteTable {
  const { contracts, ...compiled } = unionTables(parts);
  const t: RouteTable = Object.freeze({ kind: "keel.routeTable", contracts: Object.freeze(contracts) });
  tables.set(t, compiled);
  return t;
}
