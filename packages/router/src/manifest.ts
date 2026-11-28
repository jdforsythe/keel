import type { Contract } from "./contract/types/Contract.ts";
import type { Entries } from "./contract/types/Entries.ts";
import { bindTable } from "./internal/bindTable.ts";
import { madeFrozen } from "./internal/madeFrozen.ts";
import { tables } from "./internal/tables.ts";
import type { Binding } from "./types/Binding.ts";
import type { Manifest } from "./types/Manifest.ts";

/**
 * Bind every entry of `contract` and nothing else (k.contract Binding): a page `{ component, loader?, guard?,
 * layout?, errorElement?, title?, POST?, PUT?, PATCH?, DELETE? }`, a layout `{ component, loader?, guard?, layout?,
 * errorElement? }`, an API GET `{ loader, guard? }`, an API write `{ action, guard? }`; each handler declared for its id. A page's
 * `title` gets its parsed `params`, `search` and its loader's value as `data` (k.head). Throws E1515, E1510, E1508
 * and E1506 (k.routes Where rules fire). Returns the module's route table, frozen: `{ kind: 'keel.routeTable',
 * contract, contracts: [contract] }`; its bindings are no public member (`bindingsOf`, `@keel/router/internal`).
 */
export function manifest<M extends string, C extends Entries, O>(
  contract: Contract<M, C>,
  binding: Binding<C, O, M>,
): Manifest<M, C> {
  const compiled = bindTable(contract, binding);
  const m: Manifest<M, C> = madeFrozen(
    { kind: "keel.routeTable", contract, contracts: Object.freeze([contract]) },
    "routeTable",
  );
  tables.set(m, compiled);
  return m;
}
