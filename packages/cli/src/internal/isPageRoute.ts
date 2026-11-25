import type { RouteEntry } from "./RouteEntry.ts";

/** A page route (k.a11y Claims): a `path` that is not `null` and no `api: true`, whatever its `actions` or `guard`. */
export function isPageRoute(e: RouteEntry): boolean {
  return typeof e.path === "string" && !e.api;
}
