import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import { carriedParams, guardLoop, guardNext, matchUrl, runGuard, withNext } from "@keel/router/internal";
import type { Level, Located } from "@keel/router/internal";
import { needsBare } from "@keel/router/internal";
import { type KeelError, attempt } from "@keel/schema";
import type { Diag } from "./Diag.ts";
import type { GuardOutcome } from "./GuardOutcome.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { unexpected } from "./unexpected.ts";

type Routes = Manifest<Readonly<Record<string, RouteDef>>>;
type Step =
  | { readonly kind: "pass" }
  | {
      readonly kind: "fail";
      readonly at: number;
      readonly error: KeelError<string, unknown>;
      readonly diags?: readonly Diag[];
    }
  | { readonly kind: "redirect"; readonly at: number; readonly location: string };

/** The guards of `chain` for `url`, outermost first, up to the first that does not pass. */
async function step(
  chain: readonly Level[],
  url: string,
  params: Readonly<Record<string, unknown>>,
  routes: Routes,
  table: readonly Located[],
  ctx: Ctx,
  caller: string,
): Promise<Step> {
  for (const [i, lvl] of chain.entries()) {
    const g = lvl.def.guard;
    if (g === undefined) continue;
    const r = await runGuard(g, url, ctx, caller);
    if (r.ok) continue;
    if (r.error.code !== "keel.denied") return { kind: "fail", at: i, error: r.error };
    const id = g.redirect;
    // An API route's denial is 403 (k.api): no redirect is followed, so none is resolved.
    if (lvl.def.api || id === undefined) return { kind: "redirect", at: i, location: "" };
    const carried = carriedParams(id, table.find((r) => r.id === id)?.def, params);
    if (!carried.ok)
      return {
        kind: "fail",
        at: i,
        error: unexpected(carried.error),
        diags: [{ code: "E1508", message: carried.error.slice(6, 95) }],
      };
    const to = attempt(() => routes.href(id, carried.value));
    if (!to.ok)
      return {
        kind: "fail",
        at: i,
        error: unexpected(`guard redirect to "${id}" failed: ${to.error.message}`),
      };
    return { kind: "redirect", at: i, location: withNext(to.value, guardNext(table, url)) };
  }
  return { kind: "pass" };
}

/** Where the browser goes next after requesting `url`: its guards' redirect location, or `null` when none redirects. */
async function nextHop(
  url: string,
  routes: Routes,
  table: readonly Located[],
  ctx: Ctx,
  caller: string,
): Promise<string | null> {
  const m = matchUrl(table, url);
  if (m.kind !== "route") return null;
  const s = await step(m.route.chain, m.url, m.params, routes, table, ctx, caller);
  return s.kind === "redirect" ? s.location : null;
}

/**
 * Run every guard of `chain`, outermost first, before any loader (k.router Guards). `keel.denied` redirects
 * to the guard's `redirect` route with search `next` (the request path and query, or that URL's own `next` when it
 * is a guard's redirect route: never nested, `guardNext`); any other `err`, a throw fails at that level. A route's
 * `guard` is the guard value; its `redirect` resolves in the deployable's manifest `routes`.
 * Before answering a redirect, the target's guards run here, hop by hop (the browser would follow): a location
 * visited twice or a ninth redirect is E1508, a `keel.unexpected` failure at the denying level with a diag.
 * On an API route a denial is a `redirect` with location `""`, resolved nowhere (k.api).
 * Every guard gets the request's `caller` id (`""` anonymous).
 */
export async function runGuards(
  chain: readonly Level[],
  url: string,
  params: Readonly<Record<string, unknown>>,
  routes: Routes,
  table: readonly Located[],
  ctx: Ctx,
  caller: string,
): Promise<GuardOutcome> {
  const fail = (i: number, error: KeelError<string, unknown>, diags: readonly Diag[] = []): GuardOutcome => {
    const level = nearestErrorElement(chain, i);
    return { kind: "fail", failure: { level, bare: needsBare(chain, level), error }, diags };
  };
  const first = await step(chain, url, params, routes, table, ctx, caller);
  if (first.kind === "pass") return first;
  if (first.kind === "fail") return fail(first.at, first.error, first.diags);
  const visited = [url];
  let to: string | null = first.location || null;
  while (to !== null) {
    const loop = guardLoop(visited, to);
    if (loop !== null)
      return fail(first.at, unexpected(`E1508 ${loop}`), [{ code: "E1508", message: loop.slice(0, 89) }]);
    visited.push(to);
    to = await nextHop(to, routes, table, ctx, caller);
  }
  return { kind: "redirect", location: first.location };
}
