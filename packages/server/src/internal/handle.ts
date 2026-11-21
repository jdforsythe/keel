import { allowAt, matchUrl, needsBare, pageHead, underMount } from "@keel/router/internal";
import { publicError } from "@keel/router/internal";
import { err } from "@keel/schema";
import type { Context } from "hono";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { answering } from "./answering.ts";
import { bareError } from "./bareError.ts";
import { decodedQuery } from "./decodedQuery.ts";
import { denied } from "./denied.ts";
import { isVerb } from "./isVerb.ts";
import { issueCaller } from "./issueCaller.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { liveStream } from "./liveStream.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { noStore } from "./noStore.ts";
import { notFound } from "./notFound.ts";
import { page } from "./page.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { readCapped } from "./readCapped.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { runAction } from "./runAction.ts";
import { runGuards } from "./runGuards.ts";
import { sameSite } from "./sameSite.ts";
import { servedEntry } from "./servedEntry.ts";
import { statusOf } from "./statusOf.ts";
import { userOf } from "./userOf.ts";

/**
 * One request (k.server Request flow): a write (POST, PUT, PATCH, DELETE) that is not same-site gets 403
 * `keel.denied` before anything runs (CSRF, `sameSite`); one at the identity source's `handle.path` or under it then goes
 * to its `fn` with its body (over `maxBodyBytes`: 413) and gets `fn`'s response as given (k.user); a GET or HEAD of
 * `/@keel/entry.ts` gets the resume entry, or a production client build's file (`servedEntry`). Then, in order
 * (k.api Paths, Requests): match the path pattern (none: 404; a trailing slash or a prefix param's default segment:
 * 308 to the canonical path); pick the entry answering the method (`answering`; none: 405 with the pattern's `allow`,
 * no guard run); parse its params (fail: 404 at the nearest errorElement, no guard or loader runs) and a page's search
 * (failing keys dropped); ask the request's `user` (`userOf`; its failure fails the guards); run guards outermost first
 * (deny: 302, or 303 for a write, to the redirect route with `next`; a redirect loop or a ninth hop is E1508); decode
 * an API entry's `query` (fail: 422 `keel.fields`, paths prefixed `query`, `decodedQuery`); then GET and HEAD run the
 * loaders and render, a write runs the action (`runAction`; a fresh caller token is set as a cookie on its response,
 * `issueCaller`). A GET with `accept: text/event-stream` gets 406 unless the entry is an API GET with `events: true`,
 * then 403 `keel.denied` for a guard denial, else its event stream (`liveStream`).
 * An API entry (k.api) is a runtime request whatever `accept` says: JSON only, and a guard denial is 403 `keel.denied`
 * (its `redirect` not followed). A host's GET or HEAD of a path no route matches that is neither runtime, an event
 * stream nor under `/assets/` gets the hosted client's `index.html` (k.hosting Host), under the `csp.txt` policy
 * (k.security Other deployables).
 */
export async function handle(sv: Served, raw: Request, rq: RequestScope, c: Context): Promise<Handled> {
  const url = new URL(raw.url);
  const method = raw.method.toUpperCase();
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") || "/" : url.pathname;
  if (isVerb(method) && !sameSite(raw, sv.origin, rq.allowed))
    return { response: denied("cross-site write refused"), route: undefined, diags: [] };
  const mount = sv.identity?.handle;
  if (mount !== undefined && `${url.pathname}/`.startsWith(`${mount.path}/`)) {
    const body = raw.body === null ? null : await readCapped(raw, sv.maxBody);
    const sent = body === null ? raw : new Request(raw.url, { method, headers: raw.headers, body, signal: raw.signal });
    const response = raw.body !== null && body === null ? payloadTooLarge(sv.maxBody) : await mount.fn(sent, sv.ctx);
    return { response, route: undefined, diags: [] };
  }
  const resumeEntry = servedEntry(raw, url.pathname, sv.built);
  if (resumeEntry !== null) return resumeEntry;
  // No page at a path that decodes to the mount or under it (k.mount-scope): `handle` above took the textual ones.
  const found = matchUrl(sv.table, `${path}${url.search}`, mount?.path);
  const accept = raw.headers.get("accept") ?? "";
  const api = found.route?.def.kind === "api";
  const r: Req = {
    sv,
    rq,
    raw,
    url: sv.origin === undefined ? raw.url : `${sv.origin}${url.pathname}${url.search}`,
    method,
    here: `${path}${url.search}`,
    runtime: api || accept.includes("application/json"),
  };
  if (found.route === null) {
    const doc = sv.built?.index;
    // A hosted client's document (k.hosting Host): the router matches its paths in the browser.
    if (
      doc !== undefined &&
      (method === "GET" || method === "HEAD") &&
      !r.runtime &&
      !accept.includes("text/event-stream") &&
      !path.startsWith("/assets/") &&
      (mount === undefined || !underMount(path, mount.path))
    )
      return {
        response: new Response(method === "HEAD" ? null : doc.body, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache",
            "content-security-policy": doc.policy,
          },
        }),
        route: undefined,
        diags: [],
      };
    return bareError(r, undefined, 404, [], {}, { level: -1, bare: true, error: notFound(r.here) });
  }
  // A trailing slash, or a prefix param's default segment (k.prefix Parse step 2): 308 to the canonical URL.
  if (path !== url.pathname || found.url !== r.here)
    return { response: redirectResponse(308, found.url), route: found.route.id, diags: [] };
  // The entry at the matched pattern that answers the method (k.api Paths): none is 405, before any guard runs.
  const entry = answering(sv.table, found.route, method);
  if (entry === null) {
    const allow = allowAt(sv.table, found.route).join(", ");
    return { response: new Response(null, { status: 405, headers: { allow } }), route: found.route.id, diags: [] };
  }
  // Its params are its own schema's: another entry at the pattern is matched again alone.
  const m = entry === found.route ? found : matchUrl([entry], `${path}${url.search}`);
  const route = m.route?.id ?? entry.id;
  if (m.kind === "notFound") {
    const chain = (m.route ?? entry).chain;
    const level = nearestErrorElement(chain, chain.length - 1);
    return bareError(r, route, 404, chain, {}, { level, bare: needsBare(chain, level), error: notFound(r.here) });
  }
  const write = isVerb(method);
  const { def } = m.route;
  const live = def.loader;
  const stream = method === "GET" && accept.includes("text/event-stream");
  const who = await userOf(r);
  if (typeof who === "string") rq.user = who;
  const g = await runGuards(m.route.chain, r.here, m.params, sv, rq, typeof who === "string" ? undefined : who);
  if (g.kind === "redirect")
    return {
      response: stream || api ? denied("guard denied") : redirectResponse(write ? 303 : 302, g.location),
      route,
      diags: [],
    };
  if (g.kind === "fail") {
    if (stream) {
      const e = publicError(g.failure.error, sv.mode);
      return { response: jsonResponse(statusOf(e.code), err(e)), route, diags: g.diags };
    }
    const head = pageHead(m.route, m.params, { params: m.params, search: m.search, data: undefined }, true);
    const failed = bareError(r, route, statusOf(g.failure.error.code), m.route.chain, m.params, g.failure, head);
    return { ...failed, diags: [...failed.diags, ...g.diags] };
  }
  // Only an `events: true` entry's loader is live (k.server): a stream request to another entry is 406, after its
  // guards, so the answer does not tell which guarded entries are live.
  if (stream && (def.kind !== "api" || def.events !== true || live?.live === undefined))
    return { response: new Response(null, { status: 406 }), route, diags: [] };
  // An API entry's `query` is decoded after its guards, before its handler (k.api Requests): a failure is 422.
  const query = decodedQuery(def, url.searchParams);
  if (!query.ok) return { response: jsonResponse(422, err(query.error)), route, diags: [] };
  const at = { ...m, search: query.value ?? m.search };
  if (stream && live !== undefined) return liveStream(r, at, live, c);
  return write ? issueCaller(r, noStore(await runAction(r, at))) : page(r, at, 200, null, null);
}
