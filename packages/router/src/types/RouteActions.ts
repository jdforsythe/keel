import type { Action } from "./Action.ts";
import type { ApiAction } from "./ApiAction.ts";

/**
 * One route's actions by HTTP method, attached with `routes.actions({ [id]: { POST, ... } })` (k.router): a page's
 * `Action` on a page, an `ApiAction` (declaring `output`) on an API route (k.api, E1512).
 */
export type RouteActions = {
  readonly POST?: Action<unknown> | ApiAction<unknown, unknown>;
  readonly PUT?: Action<unknown> | ApiAction<unknown, unknown>;
  readonly PATCH?: Action<unknown> | ApiAction<unknown, unknown>;
  readonly DELETE?: Action<unknown> | ApiAction<unknown, unknown>;
};
