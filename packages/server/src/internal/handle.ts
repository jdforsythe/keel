import { matchUrl, needsBare } from "@keel/router";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { bareError } from "./bareError.ts";
import { isVerb } from "./isVerb.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { noStore } from "./noStore.ts";
import { notFound } from "./notFound.ts";
import { page } from "./page.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { runAction } from "./runAction.ts";
import { runGuards } from "./runGuards.ts";
import { statusOf } from "./statusOf.ts";

/**
 * One request (k.server Request flow): match the path (no pattern: 404; trailing slash: 308 to the
 * canonical path), parse params (fail: 404 at the nearest errorElement, no guard or loader runs) and search
 * (failing keys dropped), run guards outermost first (deny: 302, or 303 for a write, to the redirect route
 * with `next`), then GET/HEAD render the page and the action verbs run the action; other methods get 405.
 */
export async function handle(sv: Served, raw: Request, rq: RequestScope): Promise<Handled> {
  const url = new URL(raw.url);
  const method = raw.method.toUpperCase();
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") || "/" : url.pathname;
  const r: Req = {
    sv,
    rq,
    raw,
    method,
    here: `${path}${url.search}`,
    runtime: (raw.headers.get("accept") ?? "").includes("application/json"),
  };
  const m = matchUrl(sv.table, `${path}${url.search}`);
  const route = m.route?.id;
  if (m.kind === "notFound" && m.route === null)
    return bareError(r, route, 404, [], {}, { level: -1, bare: true, error: notFound(r.here) });
  if (path !== url.pathname) return { response: redirectResponse(308, r.here), route, diags: [] };
  if (m.kind === "notFound") {
    const chain = m.route?.chain ?? [];
    const level = nearestErrorElement(chain, chain.length - 1);
    return bareError(r, route, 404, chain, {}, { level, bare: needsBare(chain, level), error: notFound(r.here) });
  }
  const write = isVerb(method);
  if (!write && method !== "GET" && method !== "HEAD")
    return { response: new Response(null, { status: 405, headers: { allow: "GET, HEAD" } }), route, diags: [] };
  const g = await runGuards(m.route.chain, r.here, sv.guards, sv.ctx);
  if (g.kind === "redirect") return { response: redirectResponse(write ? 303 : 302, g.location), route, diags: [] };
  if (g.kind === "fail") return bareError(r, route, statusOf(g.failure.error.code), m.route.chain, m.params, g.failure);
  return write ? noStore(await runAction(r, m)) : page(r, m, 200, null, null);
}
