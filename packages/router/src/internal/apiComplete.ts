import type { Table } from "./Table.ts";
import { codedError } from "./codedError.ts";
import { routeActions } from "./routeActions.ts";

const done = new WeakSet<Table>();

/**
 * Throw E1510 for an API route (k.api) with neither a loader nor an action. Runs on the first read of a table
 * (`href`, matching, `createRouter`, `createApp`), after `routes.actions` had its chance to attach.
 */
export function apiComplete(table: Table): void {
  if (done.has(table)) return;
  for (const { id, def } of table.values())
    if (def.api && def.loader === undefined && !routeActions.has(def))
      throw codedError("E1510", `${id}: an API route needs a loader or an action`);
  done.add(table);
}
