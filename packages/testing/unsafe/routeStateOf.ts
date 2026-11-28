import type { RouteTable } from "@keel/router";
import type { RouteStateOf } from "../src/types/RouteStateOf.ts";
import { unsafe } from "./unsafe.ts";

/**
 * `x`, a route state built from a match in the table whose route ids `known` answers for, as that table's typed state,
 * or null when `x` is no such state.
 */
export function routeStateOf<T extends RouteTable>(x: unknown, known: (id: string) => boolean): RouteStateOf<T> | null {
  if (typeof x !== "object" || x === null || !("id" in x)) return null;
  if (x.id !== null && !(typeof x.id === "string" && known(x.id))) return null;
  return unsafe(
    "stateAt builds id, params, search and pending from graph.matchHref over this table, and the id was just checked against the compiled table; params and search are that route's parsed values",
    () => x as RouteStateOf<T>,
  );
}
