import type { Table } from "./Table.ts";

/**
 * Route id -> table of the most recently declared manifest containing that id. Read only by a `Form` rendered outside
 * any router (server rendering, native posting); routers, their `Form`s, redirects, and `href` use their own manifest.
 */
export const latest = new Map<string, Table>();
