import { matchUrl, needsBare } from "@keel/router/internal";
import { err } from "@keel/schema";
import type { Context } from "hono";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { bareError } from "./bareError.ts";
import { denied } from "./denied.ts";
import { isVerb } from "./isVerb.ts";
import { issueCaller } from "./issueCaller.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { liveStream } from "./liveStream.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { noStore } from "./noStore.ts";
import { notFound } from "./notFound.ts";
import { page } from "./page.ts";
import { publicError } from "./publicError.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { runAction } from "./runAction.ts";
import { runGuards } from "./runGuards.ts";
import { sameSite } from "./sameSite.ts";
import { servedEntry } from "./servedEntry.ts";
import { statusOf } from "./statusOf.ts";

/**
 * One request (k.server Request flow): a write (POST, PUT, PATCH, DELETE) that is not same-site gets 403
 * `keel.denied` before anything runs (CSRF, RFC 0022, `sameSite`); a GET or HEAD of `/@keel/entry.ts` gets the resume
 * entry, or a production client build's file (`servedEntry`, RFC 0046, 0048); then match the path (no pattern: 404; trailing
 * slash or a prefix param's default segment: 308 to the canonical path), parse params (fail: 404 at the nearest errorElement, no guard or loader runs) and search
 * (failing keys dropped), run guards outermost first (deny: 302, or 303 for a write, to the redirect route
 * with `next`; a redirect loop or a ninth hop is E1508, rfc:0051), then GET/HEAD render the page and the action verbs run the action (a fresh caller token is set as a
 * cookie on its response, `issueCaller`); other methods get 405. A GET with `accept: text/event-stream` gets 406 unless
 * the route's loader is live, then 403 `keel.denied` for a guard redirect, else its event stream (`liveStream`).
 */
export async function handle(sv: Served, raw: Request, rq: RequestScope, c: Context): Promise<Handled> {
  const url = new URL(raw.url);
  const method = raw.method.toUpperCase();
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") || "/" : url.pathname;
  const r: Req = {
    sv,
    rq,
    raw,
    url: sv.origin === undefined ? raw.url : `${sv.origin}${url.pathname}${url.search}`,
    method,
    here: `${path}${url.search}`,
    runtime: (raw.headers.get("accept") ?? "").includes("application/json"),
  };
  if (isVerb(method) && !sameSite(raw, sv.origin))
    return { response: denied("cross-site write refused"), route: undefined, diags: [] };
  const entry = servedEntry(raw, url.pathname, sv.built);
  if (entry !== null) return entry;
  const m = matchUrl(sv.table, `${path}${url.search}`);
  const route = m.route?.id;
  if (m.kind === "notFound" && m.route === null)
    return bareError(r, route, 404, [], {}, { level: -1, bare: true, error: notFound(r.here) });
  // A trailing slash, or a prefix param's default segment (k.prefix Parse step 2): 308 to the canonical URL.
  if (path !== url.pathname || m.url !== r.here) return { response: redirectResponse(308, m.url), route, diags: [] };
  if (m.kind === "notFound") {
    const chain = m.route?.chain ?? [];
    const level = nearestErrorElement(chain, chain.length - 1);
    return bareError(r, route, 404, chain, {}, { level, bare: needsBare(chain, level), error: notFound(r.here) });
  }
  const write = isVerb(method);
  if (!write && method !== "GET" && method !== "HEAD")
    return { response: new Response(null, { status: 405, headers: { allow: "GET, HEAD" } }), route, diags: [] };
  const live = m.route.def.loader;
  const stream = method === "GET" && (raw.headers.get("accept") ?? "").includes("text/event-stream");
  if (stream && live?.live === undefined) return { response: new Response(null, { status: 406 }), route, diags: [] };
  const g = await runGuards(m.route.chain, r.here, m.params, sv.routes, sv.table, sv.ctx, rq.caller.id);
  if (stream && live !== undefined) {
    if (g.kind === "redirect") return { response: denied("guard denied"), route, diags: [] };
    if (g.kind === "fail") {
      const e = publicError(g.failure.error, sv.mode);
      return { response: jsonResponse(statusOf(e.code), err(e)), route, diags: g.diags };
    }
    return liveStream(r, m, live, c);
  }
  if (g.kind === "redirect") return { response: redirectResponse(write ? 303 : 302, g.location), route, diags: [] };
  if (g.kind === "fail") {
    const failed = bareError(r, route, statusOf(g.failure.error.code), m.route.chain, m.params, g.failure);
    return { ...failed, diags: [...failed.diags, ...g.diags] };
  }
  return write ? issueCaller(r, noStore(await runAction(r, m))) : page(r, m, 200, null, null);
}
