import type { Located } from "./Located.ts";
import { atPattern } from "./atPattern.ts";

/**
 * The route that answers `method` at matched `route`'s path pattern in `list` (k.api Paths): a page for GET, HEAD
 * and its bound verbs; the API entry of that method, HEAD answered by the GET entry. `null`: a 405 (`allowAt`).
 * OPTIONS is no entry method. The server decodes `params` by the entry it gets (`matchUrl` over `[entry]`).
 */
export function entryAt(list: readonly Located[], route: Located, method: string): Located | null {
  const want = method === "HEAD" ? "GET" : method;
  if (route.def.kind === "page") return want === "GET" || Object.hasOwn(route.def.actions, want) ? route : null;
  return atPattern(list, route).find((r) => r.def.method === want) ?? null;
}
