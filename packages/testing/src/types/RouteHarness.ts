import type { Href } from "@keel/router";
import type { Harness } from "./Harness.ts";

/** A rendered route: the `render` harness plus `route()`, the router's current match, and `navigate`. */
export interface RouteHarness<S> extends Harness {
  route(): S;
  /**
   * Navigate the harness's router to `href` (a push); resolves when the new route is rendered and its loaders have
   * settled, the quiescence `fire` waits for, then runs the render checks (rfc:0070).
   */
  navigate(href: Href): Promise<void>;
}
