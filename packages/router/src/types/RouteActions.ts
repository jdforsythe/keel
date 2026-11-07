import type { Action } from "./Action.ts";

/** One route's actions by HTTP method, attached with `routes.actions({ [id]: { POST, ... } })` (k.router, RFC 0063). */
export type RouteActions = {
  readonly POST?: Action<unknown>;
  readonly PUT?: Action<unknown>;
  readonly PATCH?: Action<unknown>;
  readonly DELETE?: Action<unknown>;
};
