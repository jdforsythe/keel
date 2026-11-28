import type { RouteEntry } from "./RouteEntry.ts";
import { isRecord } from "./isRecord.ts";

/** The entries of a `routes.json` artifact (`{ data, hash }`, or the bare map), sorted by id; text that is not JSON has none. */
export function routeEntries(source: string): RouteEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }
  const data = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : isRecord(parsed) ? parsed : {};
  return Object.keys(data)
    .sort()
    .map((id) => {
      const e = data[id];
      const entry = isRecord(e) ? e : {};
      const path = typeof entry.path === "string" ? entry.path : entry.path === null ? null : undefined;
      return {
        id,
        path,
        api: entry.api === true,
        layout: typeof entry.layout === "string" ? entry.layout : undefined,
        module: typeof entry.module === "string" ? entry.module : (id.split(".")[0] ?? id),
      };
    });
}
