import type { ServedRoute } from "./ServedRoute.ts";
import { isRecord } from "./isRecord.ts";

/** `#k-state`'s `route` when it has the served-route shape (rfc:0071), else `null`. */
export function readRoute(x: unknown): ServedRoute | null {
  if (!isRecord(x)) return null;
  const { id, path, href, params, search } = x;
  if (typeof id !== "string" || typeof path !== "string" || typeof href !== "string") return null;
  return isRecord(params) && isRecord(search) ? { id, path, href, params, search } : null;
}
