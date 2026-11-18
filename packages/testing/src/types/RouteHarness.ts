import type { Href } from "@keel/router";
import type { DocumentNavigation } from "./DocumentNavigation.ts";
import type { Harness } from "./Harness.ts";

/** A rendered route: the `render` harness plus `route()`, the router's current match, and `navigate`. */
export interface RouteHarness<S> extends Harness {
  route(): S;
  /**
   * Navigate the harness's router to `href` (a push); resolves when the new route is rendered and its loaders have
   * settled, the quiescence `fire` waits for, then runs the render checks.
   */
  navigate(href: Href): Promise<void>;
  /** The in-memory history's entry count (a `replace` leaves it, a push adds one) and `window.scrollY`. */
  location(): { readonly entries: number; readonly scrollY: number };
  /** The document navigations the page started, in order (k.mount Testing); none is made, so the page stays. */
  documents(): readonly DocumentNavigation[];
}
