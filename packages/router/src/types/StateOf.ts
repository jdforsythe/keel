import type { Manifest } from "./Manifest.ts";
import type { RouteState } from "./RouteState.ts";

/** The route state of a route table's router: a manifest's typed by its contract's entries, a union's wide. */
export type StateOf<T> = T extends Manifest<string, infer C>
  ? RouteState<C>
  : RouteState<Readonly<Record<string, object>>>;
