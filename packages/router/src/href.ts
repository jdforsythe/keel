import { toHref } from "../unsafe/toHref.ts";
import { codedError } from "./internal/codedError.ts";
import { flattenJson } from "./internal/flattenJson.ts";
import { routeTable } from "./internal/routeTable.ts";
import { stripUndefined } from "./internal/stripUndefined.ts";
import { toRecord } from "./internal/toRecord.ts";
import type { Href } from "./types/Href.ts";

const byKey = (a: readonly [string, string], b: readonly [string, string]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

/**
 * Link to route `id` (k.router Links). Params are encoded by the route's params schema then URL-encoded
 * into the path; search is encoded by its search schema, absent optionals omitted, keys sorted. Equal
 * inputs give an identical `Href`. Throws for an unknown id, a layout, or values that fail the schemas.
 */
export function href(
  id: string,
  params: Readonly<Record<string, unknown>> = {},
  search: Readonly<Record<string, unknown>> = {},
): Href {
  const route = routeTable.get(id);
  if (route === undefined || route.segments === null)
    throw codedError("E1501", `href("${id}"): no route with a path has this id`);
  const { def, segments } = route;
  const encoded = def.params === undefined ? {} : def.params.encode(stripUndefined(params));
  const fields = toRecord(encoded);
  const path = segments
    .map((s) => {
      if (s.kind === "static") return s.text;
      const v = fields[s.name];
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean")
        throw codedError("E1503", `href("${id}"): param "${s.name}" does not encode to a path segment`);
      return encodeURIComponent(String(v));
    })
    .join("/");
  const present = stripUndefined(search);
  const entries: [string, string][] = [];
  if (def.search !== undefined) flattenJson("", def.search.encode(present), entries);
  else if (Object.keys(present).length > 0) throw codedError("E1504", `href("${id}"): the route declares no search`);
  entries.sort(byKey);
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return toHref(`/${path}${query === "" ? "" : `?${query}`}`);
}
