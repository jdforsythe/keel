import { s } from "@keel/schema";
import type { RouteEntry } from "../types/RouteEntry.ts";

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNullableString = (x: unknown): x is string | null => x === null || typeof x === "string";

const Json = s.json();

function isRouteEntry(x: unknown): x is RouteEntry {
  return (
    isRecord(x) &&
    Array.isArray(x.actions) &&
    x.actions.every((v) => typeof v === "string") &&
    isNullableString(x.guard) &&
    isNullableString(x.layout) &&
    typeof x.module === "string" &&
    isNullableString(x.path) &&
    (x.api === undefined || x.api === true) &&
    (x.method === undefined || typeof x.method === "string") &&
    Json.parse(x.params).ok &&
    Json.parse(x.search).ok
  );
}

/** `routes.json`'s data read from `x` (k.router Artifacts): each well-formed route entry by id, ids sorted; none from a non-object. */
export function routeEntries(x: unknown): Record<string, RouteEntry> {
  const routes: Record<string, RouteEntry> = Object.create(null);
  if (!isRecord(x)) return routes;
  for (const id of Object.keys(x).sort()) {
    const entry = x[id];
    if (isRouteEntry(entry)) routes[id] = entry;
  }
  return routes;
}
