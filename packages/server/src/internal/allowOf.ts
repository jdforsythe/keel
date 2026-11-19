import type { RouteDef } from "@keel/router";
import { routeActions } from "@keel/router/internal";

/** A 405's `allow`: GET and HEAD unless the route is an API route without a loader (k.api), then its action methods. */
export function allowOf(def: RouteDef): string {
  return [...(def.api && !def.loader ? [] : ["GET", "HEAD"]), ...Object.keys(routeActions.get(def) ?? {})].join(", ");
}
