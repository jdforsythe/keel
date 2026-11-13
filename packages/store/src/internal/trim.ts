import type { Row } from "./Row.ts";
import { freeze } from "./freeze.ts";

/**
 * Keep the latest `limit` of `rows` (k.store Log limit): the older ones are folded, oldest first, into
 * `base`, the state `undo` replays from. Within the limit both come back unchanged (the same array).
 */
export function trim<T>(base: T, rows: Row<T>[], limit: number): { readonly base: T; readonly rows: Row<T>[] } {
  const over = rows.length - limit;
  if (over <= 0) return { base, rows };
  return { base: rows.slice(0, over).reduce((st, r) => freeze(r.apply(st)), base), rows: rows.slice(over) };
}
