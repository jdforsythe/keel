import { type Located, entryAt } from "@keel/router/internal";

/**
 * The entry of `list` that answers `method` at matched `route`'s path pattern (k.api Paths), or `null` for a 405. A
 * page's POST is its own whenever it binds a verb: a `_method` field may name another one, read with the body after the
 * guards (`runAction`). Otherwise `entryAt`: a page for GET, HEAD and its bound verbs; the API entry of that method,
 * HEAD answered by the GET entry; OPTIONS by none.
 */
export function answering(list: readonly Located[], route: Located, method: string): Located | null {
  if (route.def.kind === "page" && method === "POST" && Object.keys(route.def.actions).length > 0) return route;
  return method === "OPTIONS" ? null : entryAt(list, route, method);
}
