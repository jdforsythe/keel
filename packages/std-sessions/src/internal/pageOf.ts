import type { RouteTable } from "@keel/router";
import type { PageEntry } from "@keel/router/contract";

/** Whether contract entry `e` is a page: a `path`, no `method` (an API entry) and no `layout`. */
const isPage = (e: object): e is PageEntry =>
  !("method" in e) && !("layout" in e) && "path" in e && typeof e.path === "string";

/**
 * The page entry at `id` of route table `table` (k.routes): read from the contract in `table.contracts` whose
 * `entries` hold `id`, with its `path`, `params` and `search`; undefined for an id the table lacks, an API entry or a
 * layout. A table's contracts are its public view: no handler, no kernel `internal` entry.
 */
export function pageOf(table: RouteTable, id: string): PageEntry | undefined {
  for (const c of table.contracts) {
    if (!Object.hasOwn(c.entries, id)) continue;
    const e = c.entries[id];
    return e !== undefined && isPage(e) ? e : undefined;
  }
  return undefined;
}
