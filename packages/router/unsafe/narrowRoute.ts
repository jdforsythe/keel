import type { Computed } from "@keel/reactive";
import type { RouteState } from "../src/types/RouteState.ts";
import { unsafe } from "./unsafe.ts";

type Wide = RouteState<Readonly<Record<string, unknown>>>;

/** Restore the manifest's typed route union on the router's untyped route computed. */
export function narrowRoute<M>(route: Computed<Wide>): Computed<RouteState<M>> {
  return unsafe(
    "route state is built only from a match in this manifest: id is its key, params and search were parsed by that route's own schemas",
    () => route as Computed<unknown> as Computed<RouteState<M>>,
  );
}
