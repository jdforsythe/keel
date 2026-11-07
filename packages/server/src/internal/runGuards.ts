import type { Ctx } from "@keel/ctx";
import { type Manifest, type RouteDef, runGuard } from "@keel/router";
import type { Level } from "@keel/router";
import { needsBare } from "@keel/router";
import { type KeelError, attempt } from "@keel/schema";
import type { GuardOutcome } from "./GuardOutcome.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { unexpected } from "./unexpected.ts";

const withNext = (to: string, next: string): string =>
  `${to}${to.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;

/**
 * Run every guard of `chain`, outermost first, before any loader (k.router Guards). `keel.denied` redirects
 * to the guard's `redirect` route with search `next` (the request path and query); any other `err`, a
 * throw fails at that level. A route's `guard` is the guard value (RFC 0041); its `redirect` resolves in the
 * deployable's manifest `routes`.
 */
export async function runGuards(
  chain: readonly Level[],
  url: string,
  routes: Manifest<Readonly<Record<string, RouteDef>>>,
  ctx: Ctx,
): Promise<GuardOutcome> {
  const fail = (i: number, error: KeelError<string, unknown>): GuardOutcome => {
    const level = nearestErrorElement(chain, i);
    return { kind: "fail", failure: { level, bare: needsBare(chain, level), error } };
  };
  for (const [i, lvl] of chain.entries()) {
    const g = lvl.def.guard;
    if (g === undefined) continue;
    const r = await runGuard(g, url, ctx);
    if (r.ok) continue;
    if (r.error.code !== "keel.denied") return fail(i, r.error);
    const to = attempt(() => routes.href(g.redirect));
    if (!to.ok) return fail(i, unexpected(`guard redirect to "${g.redirect}" failed: ${to.error.message}`));
    return { kind: "redirect", location: withNext(to.value, url) };
  }
  return { kind: "pass" };
}
