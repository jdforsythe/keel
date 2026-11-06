import type { Ctx } from "@keel/ctx";
import { type Guard, href } from "@keel/router";
import { type KeelError, attempt } from "@keel/schema";
import type { GuardOutcome } from "./GuardOutcome.ts";
import type { Level } from "./Level.ts";
import { isGuard } from "./isGuard.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { needsBare } from "./needsBare.ts";
import { unexpected } from "./unexpected.ts";

const withNext = (to: string, next: string): string =>
  `${to}${to.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;

/**
 * Run every guard of `chain`, outermost first, before any loader (k.router Guards). `keel.denied` redirects
 * to the guard's `redirect` route with search `next` (the request path and query); any other `err`, a
 * throw, or an unknown guard name fails at that level. A route's `guard` is a name (resolved in `guards`)
 * or the `Guard` itself.
 */
export async function runGuards(
  chain: readonly Level[],
  url: string,
  guards: ReadonlyMap<string, Guard>,
  ctx: Ctx,
): Promise<GuardOutcome> {
  const fail = (i: number, error: KeelError<string, unknown>): GuardOutcome => {
    const level = nearestErrorElement(chain, i);
    return { kind: "fail", failure: { level, bare: needsBare(chain, level), error } };
  };
  for (const [i, lvl] of chain.entries()) {
    const raw: unknown = lvl.def.guard;
    if (raw === undefined) continue;
    const g = isGuard(raw) ? raw : typeof raw === "string" ? guards.get(raw) : undefined;
    if (g === undefined) return fail(i, unexpected(`E1506 unknown guard "${String(raw)}"`));
    const ran = await attempt(() => g.run({ url }, ctx));
    const r = ran.ok ? ran.value : ran;
    if (r.ok) continue;
    if (r.error.code !== "keel.denied") return fail(i, r.error);
    const to = attempt(() => href(g.redirect));
    if (!to.ok) return fail(i, unexpected(`guard redirect to "${g.redirect}" failed: ${to.error.message}`));
    return { kind: "redirect", location: withNext(to.value, url) };
  }
  return { kind: "pass" };
}
