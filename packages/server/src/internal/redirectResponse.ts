import { isHref } from "@keel/router/internal";
import { err } from "@keel/schema";
import { jsonResponse } from "./jsonResponse.ts";
import { unexpected } from "./unexpected.ts";

/**
 * A redirect: 302 (guard denial on GET), 303 (after an action or a denied write), 308 (trailing slash). A `location`
 * that is no `Href` (not one leading `/`, `//`, a backslash, a control character: `isHref`) is never sent: the answer
 * is 500 `keel.unexpected` with no `location`, so no redirect leaves the origin.
 */
export function redirectResponse(status: 302 | 303 | 308, location: string): Response {
  if (!isHref(location)) {
    const res = jsonResponse(500, err(unexpected("a redirect to a location that is no path of this origin")));
    res.headers.set("cache-control", "no-store");
    return res;
  }
  return new Response(null, {
    status,
    headers: status === 308 ? { location } : { location, "cache-control": "no-store" },
  });
}
