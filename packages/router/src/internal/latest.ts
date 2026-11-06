import type { Table } from "./Table.ts";

/**
 * Route id -> table of the most recently declared manifest containing that id. Read only by the free
 * `href(id)` (its id carries no manifest); routers, `Form`, and redirects use their own manifest's table.
 */
export const latest = new Map<string, Table>();
