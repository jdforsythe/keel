import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import { bindingsOf } from "../internal/bindingsOf.ts";
import { compileRoutes } from "../internal/compileRoutes.ts";
import { encodeHref } from "../internal/encodeHref.ts";
import { returnRefused } from "../internal/returnRefused.ts";
import { shapesOf } from "../internal/shapesOf.ts";
import type { Href } from "../types/Href.ts";
import type { RouteTable } from "../types/RouteTable.ts";
import { matchHref } from "./matchHref.ts";

const refused = (): Result<never, KeelError<"keel.notFound", null>> =>
  err({ code: "keel.notFound", message: "not a page", data: null });

/** Per route table, the ids that are some guard's `redirect` route. */
const redirects = new WeakMap<object, ReadonlySet<string>>();

function redirectsOf(routes: RouteTable): ReadonlySet<string> {
  let set = redirects.get(routes);
  if (set === undefined) {
    set = new Set(compileRoutes(routes).located.flatMap((r) => r.chain.flatMap((l) => l.def.guard?.redirect ?? [])));
    redirects.set(routes, set);
  }
  return set;
}

/**
 * Read `text`, such as the `next` a guard redirect carries, into an `Href` of a page of route table `routes` (k.router
 * Return targets). `err` `keel.notFound`, message `not a page`, data `null` (the text is never echoed) for text that
 * `returnRefused` refuses, that no page matches as `matchHref` does, or that is a guard's `redirect` page. Otherwise
 * `ok` of the page's contract `href` for the match: rebuilt, never copied; declared search keys that parse survive,
 * every other key and the hash drop. Throws nothing.
 */
export function pageHref(routes: RouteTable, text: string): Result<Href, KeelError<"keel.notFound", null>> {
  if (returnRefused(text)) return refused();
  const m = matchHref(routes, text);
  if (m === null || redirectsOf(routes).has(m.id)) return refused();
  const bound = bindingsOf(routes).get(m.id);
  if (bound === undefined) return refused();
  const built = attempt(() => encodeHref(m.id, shapesOf.get(bound.contract)?.get(m.id), m.params, m.search));
  // A param that decoded to a slash, a backslash or a dot segment would write a path a proxy reads differently.
  return built.ok && !returnRefused(built.value) ? ok(built.value) : refused();
}
