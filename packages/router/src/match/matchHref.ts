import type { Located } from "../internal/Located.ts";
import { compileRoutes } from "../internal/compileRoutes.ts";
import { matchUrl } from "../internal/matchUrl.ts";
import type { RouteTable } from "../types/RouteTable.ts";
import type { RouteMatch } from "./RouteMatch.ts";

/** Per route table, its pages for matching. */
const lists = new WeakMap<object, readonly Located[]>();

/**
 * Match `href` against route table `routes` as a navigation does (k.router `@keel/router/match`): static segments
 * beat `:param`, params decode by the page's schema, failing search keys drop. Returns `{ id, params, search }`, or
 * `null` when no page matches (an API entry's path included, k.api) or its params fail. A contract's
 * `href(id, params, search)` is the inverse.
 */
export function matchHref(routes: RouteTable, href: string): RouteMatch | null {
  let list = lists.get(routes);
  if (list === undefined) {
    list = compileRoutes(routes).located.filter((r) => r.def.kind === "page");
    lists.set(routes, list);
  }
  const m = matchUrl(list, href);
  return m.kind === "route" ? { id: m.route.id, params: m.params, search: m.search } : null;
}
