import type { Href } from "../types/Href.ts";
import type { Table } from "./Table.ts";
import { apiComplete } from "./apiComplete.ts";
import { codedError } from "./codedError.ts";
import { flattenJson } from "./flattenJson.ts";
import { isHref } from "./isHref.ts";
import { prefixOf } from "./prefixOf.ts";
import { stripUndefined } from "./stripUndefined.ts";
import { toRecord } from "./toRecord.ts";

const byKey = (a: readonly [string, string], b: readonly [string, string]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

/**
 * Build the `Href` of page `id` in `table` (an API route has none, k.api): params encoded by the params schema then URL-encoded into the
 * path; search encoded by the search schema, absent optionals omitted, keys sorted.
 */
export function hrefIn(
  table: Table | undefined,
  id: string,
  params: Readonly<Record<string, unknown>>,
  search: Readonly<Record<string, unknown>>,
): Href {
  if (table !== undefined) apiComplete(table);
  const route = table?.get(id);
  if (route === undefined || route.segments === null || route.def.api)
    throw codedError("E1501", `href("${id}"): no declared page has this id`);
  const { def, segments } = route;
  const fields = toRecord(def.params === undefined ? {} : def.params.encode(stripUndefined(params)));
  // k.prefix Write: the prefix param's default value leaves its segment out.
  const pre = prefixOf(def, segments);
  const elide = pre !== null && fields[pre.name] === pre.d;
  const path = (elide ? segments.slice(1) : segments)
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
  const out = `/${path}${query === "" ? "" : `?${query}`}`;
  if (!isHref(out)) throw codedError("E1501", `href("${id}"): built "${out}" is not a path`);
  return out;
}
