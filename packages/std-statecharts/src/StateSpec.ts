import type { Target } from "./Target.ts";

/**
 * A declared state (std.statecharts): `on` maps an event to a target or a list of targets tried in order; a `final`
 * state has no `on`.
 */
export type StateSpec<E extends string, S extends string, G extends string, A extends string> = {
  readonly on?: { readonly [K in E]?: Target<S, G, A> | readonly Target<S, G, A>[] };
  readonly final?: boolean;
};
