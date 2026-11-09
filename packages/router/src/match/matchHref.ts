import type { Located } from "../internal/Located.ts";
import { compileRoutes } from "../internal/compileRoutes.ts";
import { matchUrl } from "../internal/matchUrl.ts";
import { tables } from "../internal/tables.ts";
import type { Manifest } from "../types/Manifest.ts";
import type { RouteDef } from "../types/RouteDef.ts";
import type { RouteMatch } from "./RouteMatch.ts";

/** Per manifest, its path routes for matching. Not sealed: matching here never stops `routes.actions` (E1505). */
const lists = new WeakMap<object, readonly Located[]>();

/**
 * Match `href` against `routes` as a navigation does (k.router `@keel/router/match`, rfc:0071): static segments beat
 * `:param`, params decode by the route's schema, failing search keys drop. Returns `{ id, params, search }`, or `null`
 * when no path route matches or its params fail. `routes.href(id, params, search)` is the inverse.
 */
export function matchHref<M extends Readonly<Record<string, RouteDef>>>(
  routes: Manifest<M>,
  href: string,
): RouteMatch | null {
  let list = lists.get(routes);
  if (list === undefined) {
    const table = tables.get(routes) ?? compileRoutes(routes.routes);
    list = [...table.values()].flatMap(({ id, def, segments }) =>
      segments === null ? [] : [{ id, def, segments, chain: [] }],
    );
    lists.set(routes, list);
  }
  const m = matchUrl(list, href);
  return m.kind === "route" ? { id: m.route.id, params: m.params, search: m.search } : null;
}
