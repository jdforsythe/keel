import type { Computed } from "@keel/reactive";
import type { Href } from "./Href.ts";

/** A running router from `createRouter`; `S` is the route state, `RouteState<M>` of its manifest. */
export type Router<S> = {
  /** Push (or replace) `href`; resolves when the navigation commits, redirects, or is superseded. */
  navigate(href: Href, opts?: { readonly replace?: boolean }): Promise<void>;
  /** The current match; `pending` while the router is busy: a navigation, revalidation, or `Form` action in flight. */
  readonly route: Computed<S>;
  /** Root component for `mount(router.App, el)`: the matched chain inside a Boundary. */
  App(): Node;
  dispose(): void;
};
