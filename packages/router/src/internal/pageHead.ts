import { attempt } from "@keel/schema";
import type { RouteProps } from "../types/RouteProps.ts";
import type { DocHead } from "./DocHead.ts";
import type { Located } from "./Located.ts";
import type { Rec } from "./Rec.ts";
import { prefixOf } from "./prefixOf.ts";

/**
 * The head of a page (k.head): `title` is the matched route's `title(props)`, null (the fallback) without one, when
 * `failed` (a loader `err` in the chain, or another failure) or when it throws; `lang` is the matched params' value of
 * the route's prefix param (k.prefix), `en` for a route without one and for no route.
 */
export function pageHead(route: Located | null, params: Rec, props: RouteProps, failed: boolean): DocHead {
  const pre = route === null ? null : prefixOf(route.def, route.segments);
  const value = pre === null ? undefined : params[pre.name];
  const lang = typeof value === "string" ? value : "en";
  const def = route?.def;
  if (failed || def?.title === undefined) return { title: null, lang };
  const made = attempt(() => def.title?.(props));
  return { title: made.ok && typeof made.value === "string" ? made.value : null, lang };
}
