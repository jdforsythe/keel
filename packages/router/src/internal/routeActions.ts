import type { RouteActions } from "../types/RouteActions.ts";
import type { RouteDef } from "../types/RouteDef.ts";

/**
 * The actions `routes.actions()` attached to each route entry (RFC 0063). Keyed by the entry object, so a union
 * manifest built from `{ ...a.routes, ...b.routes }` keeps them.
 */
export const routeActions = new WeakMap<RouteDef, RouteActions>();
