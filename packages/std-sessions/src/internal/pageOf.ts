import type { RouteTable } from "@keel/router";
import { type Schema, isSchema } from "@keel/schema";

/** A page entry as `pageOf` reads it: its `path` and, where present, its `params` and `search` schemas. */
type Page = { readonly path: string; readonly params?: Schema<unknown>; readonly search?: Schema<unknown> };

/** Contract entry `e` as a page: a `path`, no `method` (an API entry), no `layout`, schemas where present. */
function pageEntry(e: object): Page | undefined {
  if ("method" in e || "layout" in e || !("path" in e) || typeof e.path !== "string") return undefined;
  const params = "params" in e ? e.params : undefined;
  const search = "search" in e ? e.search : undefined;
  if ((params !== undefined && !isSchema(params)) || (search !== undefined && !isSchema(search))) return undefined;
  return {
    path: e.path,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
  };
}

/**
 * The page entry at `id` of route table `table` (k.routes): read from the contract in `table.contracts` whose
 * `entries` hold `id`, with its `path`, `params` and `search`; undefined for an id the table lacks, an API entry or a
 * layout. A table's contracts are its public view: no handler, no kernel `internal` entry.
 */
export function pageOf(table: RouteTable, id: string): Page | undefined {
  for (const c of table.contracts) {
    if (!Object.hasOwn(c.entries, id)) continue;
    const e = c.entries[id];
    return e === undefined ? undefined : pageEntry(e);
  }
  return undefined;
}
