import type { Href } from "../types/Href.ts";
import type { EntryShape } from "./EntryShape.ts";
import type { Rec } from "./Rec.ts";
import { codedError } from "./codedError.ts";
import { flattenJson } from "./flattenJson.ts";
import { isHref } from "./isHref.ts";
import { prefixOf } from "./prefixOf.ts";
import { stripUndefined } from "./stripUndefined.ts";
import { toRecord } from "./toRecord.ts";

const byKey = (a: readonly [string, string], b: readonly [string, string]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

/**
 * The `Href` of page `page` (k.router Links): params encoded by its params schema then URL-encoded into the path (a
 * prefix param at its default leaves its segment out, k.prefix Write); search encoded by its search schema, absent
 * optionals omitted, keys sorted. A param that encodes to no segment (not a string, number or boolean, or `''`)
 * throws E1503. `undefined` (no such page: a layout, an API entry, an unknown id) throws E1501.
 */
export function encodeHref(id: string, page: EntryShape | undefined, params: Rec, search: Rec): Href {
  if (page === undefined || page.kind !== "page" || page.segments === null)
    throw codedError("E1501", `href("${id}"): no page of this contract has this id`);
  const { segments } = page;
  const fields = toRecord(page.params === undefined ? {} : page.params.encode(stripUndefined(params)));
  const pre = prefixOf(page, segments);
  const elide = pre !== null && fields[pre.name] === pre.d;
  const path = (elide ? segments.slice(1) : segments)
    .map((s) => {
      if (s.kind === "static") return s.text;
      const v = fields[s.name];
      if ((typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") || v === "")
        throw codedError("E1503", `href("${id}"): param "${s.name}" does not encode to a path segment`);
      return encodeURIComponent(String(v));
    })
    .join("/");
  const present = stripUndefined(search);
  const entries: [string, string][] = [];
  if (page.search !== undefined) flattenJson("", page.search.encode(present), entries);
  else if (Object.keys(present).length > 0) throw codedError("E1504", `href("${id}"): the page declares no search`);
  entries.sort(byKey);
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const out = `/${path}${query === "" ? "" : `?${query}`}`;
  if (!isHref(out)) throw codedError("E1501", `href("${id}"): built "${out}" is not a path`);
  return out;
}
