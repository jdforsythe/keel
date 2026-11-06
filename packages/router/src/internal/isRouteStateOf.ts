import type { RouteState } from "../types/RouteState.ts";

/**
 * Narrow a route state built from a match in `routes` to the manifest's typed union: its id is null or a
 * key of `routes` with a path. Params and search were parsed by that route's own schemas at match time.
 */
export function isRouteStateOf<M extends object>(routes: M, x: unknown): x is RouteState<M> {
  if (typeof x !== "object" || x === null || !("id" in x) || !("pending" in x)) return false;
  return x.id === null || (typeof x.id === "string" && Object.hasOwn(routes, x.id));
}
