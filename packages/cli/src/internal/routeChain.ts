import type { RouteEntry } from "./RouteEntry.ts";

/**
 * The chain of `start` (k.a11y Claims): the entry itself, then each layout its `layout` names in turn, as far as
 * `byId` holds them; an id met twice ends the walk.
 */
export function routeChain(start: RouteEntry, byId: ReadonlyMap<string, RouteEntry>): RouteEntry[] {
  const out: RouteEntry[] = [start];
  const seen = new Set([start.id]);
  let next = start.layout;
  while (next !== undefined && !seen.has(next)) {
    const e = byId.get(next);
    if (e === undefined) break;
    out.push(e);
    seen.add(next);
    next = e.layout;
  }
  return out;
}
