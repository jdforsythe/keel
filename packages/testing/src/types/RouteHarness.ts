import type { Harness } from "./Harness.ts";

/** A rendered route: the `render` harness plus `route()`, the router's current match. */
export interface RouteHarness<S> extends Harness {
  route(): S;
}
