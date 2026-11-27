import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import { heldMap } from "@keel/schema/internal";
import { bindingsOf } from "../internal/bindingsOf.ts";
import { compileRoutes } from "../internal/compileRoutes.ts";
import { encodeHref } from "../internal/encodeHref.ts";
import { returnRefused } from "../internal/returnRefused.ts";
import { shapesOf } from "../internal/shapesOf.ts";
import type { Href } from "../types/Href.ts";
import type { RouteTable } from "../types/RouteTable.ts";
import { matchHref } from "./matchHref.ts";

const NOT_A_PAGE: KeelError<"keel.notFound", null> = { code: "keel.notFound", message: "not a page", data: null };
const refused = (): Result<never, KeelError<"keel.notFound", null>> => err(NOT_A_PAGE);

/** Per route table, the ids that are some guard's `redirect` route. */
const redirects = heldMap<object, ReadonlySet<string>>();

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
  // A param or search value its schema refuses to encode is no page: encodeHref and the schema throw an Error.
  const built = attempt(
    () => ({ href: encodeHref(m.id, shapesOf.get(bound.contract)?.get(m.id), m.params, m.search) }),
    (x) => (x instanceof Error ? NOT_A_PAGE : undefined),
  );
  // A param that decoded to a slash, a backslash or a dot segment would write a path a proxy reads differently.
  return built.ok && !returnRefused(built.value.href) ? ok(built.value.href) : refused();
}
