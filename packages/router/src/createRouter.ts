import type { Ctx } from "@keel/ctx";
import { createRouterWith } from "./internal/createRouterWith.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";
import type { RouteState } from "./types/RouteState.ts";
import type { Router } from "./types/Router.ts";
import type { RouterHistory } from "./types/RouterHistory.ts";

/**
 * Start a client router over `routes` (k.router Client). Navigation: match, parse params (fail: 404 to the
 * nearest errorElement, no loader) and search (failing keys dropped), run every guard outermost first
 * (denied: redirect to the guard's `redirect` with `?next=`), then every loader of the chain concurrently,
 * then commit. The previous page stays rendered and `pending` is true until the commit. Guards, loaders and actions get
 * `caller` (default `""`; the harness supplies one). Each navigation that is not a guard's redirect reports `nav` to
 * the ctx's observers before its guards, and each loader or action `err` reports `error` (k.ctx Observers). A loader
 * or action naming `stores` (server state, k.server) is `keel.unexpected`: it runs on a `node` deployable only.
 * `mode` is `mount`'s (k.errors), default `production`: unless it is `dev`, a `keel.unexpected` the default alert,
 * an `errorElement` or a `Form` gets has message `unexpected` and data `{}`, as from the server; observers and
 * `mount`'s `onError` get the full error.
 */
export function createRouter<M extends Readonly<Record<string, RouteDef>>>(
  routes: Manifest<M>,
  opts: {
    readonly ctx: Ctx;
    readonly history: RouterHistory;
    readonly caller?: string;
    readonly mode?: "dev" | "production";
  },
): Router<RouteState<M>> {
  return createRouterWith(routes, opts);
}
