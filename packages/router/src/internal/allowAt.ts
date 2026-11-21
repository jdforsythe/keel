import type { Located } from "./Located.ts";
import { atPattern } from "./atPattern.ts";

const ORDER = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];

/**
 * The methods answered at matched `route`'s path pattern in `list` (k.api Paths), in the order GET, HEAD, POST, PUT,
 * PATCH, DELETE: for a page GET, HEAD and its bound verbs; for API entries their methods, HEAD with GET. A 405's
 * `allow` and a preflight's `access-control-allow-methods`.
 */
export function allowAt(list: readonly Located[], route: Located): readonly string[] {
  const have = new Set<string>();
  for (const r of atPattern(list, route)) {
    if (r.def.kind === "page") have.add("GET");
    else if (r.def.method !== undefined) have.add(r.def.method);
    for (const v of Object.keys(r.def.actions)) have.add(v);
  }
  if (have.has("GET")) have.add("HEAD");
  return ORDER.filter((m) => have.has(m));
}
