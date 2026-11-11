import { attempt } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Peer } from "./Peer.ts";
import type { Served } from "./Served.ts";
import { crashed } from "./crashed.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { readCapped } from "./readCapped.ts";
import { unexpected } from "./unexpected.ts";

/** Hop-by-hop headers (RFC 9110 7.6.1) and the ones the forwarded request recomputes: never sent to a peer. */
const HOP = /^(connection|keep-alive|transfer-encoding|te|trailer|upgrade|expect|host|content-length|proxy-.*)$/;

/**
 * Forward `raw` to `peer` (k.topology Calls and peers): method, path, search, body and headers but hop-by-hop ones
 * (`HOP` and those `connection` names), plus `x-keel-forwarded: 1`. A peer by URL gets the request at that URL's
 * origin plus the path and search, through `ctx.net.fetch`; an in-process peer at the request's own URL. Redirects are
 * not followed, so the peer's response, a 3xx with its `location` and `set-cookie` too, is returned as is. A body over
 * `maxBody` is 413 `keel.payloadTooLarge` and nothing is sent; a peer that cannot be reached is 502 `keel.unexpected`
 * with one `diag`.
 */
export async function forward(raw: Request, peer: Peer, sv: Served): Promise<Handled> {
  const url = new URL(raw.url);
  const headers = new Headers(raw.headers);
  const named = (headers.get("connection") ?? "").split(",").map((n) => n.trim().toLowerCase());
  for (const h of [...headers.keys()]) if (HOP.test(h) || named.includes(h)) headers.delete(h);
  headers.set("x-keel-forwarded", "1");
  const body = raw.method === "GET" || raw.method === "HEAD" ? new Uint8Array(0) : await readCapped(raw, sv.maxBody);
  if (body === null) return { response: payloadTooLarge(sv.maxBody), route: undefined, diags: [] };
  const byUrl = typeof peer === "string" || peer instanceof URL;
  const sent = await attempt(() => {
    const at = byUrl ? `${new URL(peer).origin}${url.pathname}${url.search}` : url;
    const req = new Request(at, {
      method: raw.method,
      headers,
      body: body.length > 0 ? body : null,
      signal: raw.signal,
      redirect: "manual",
    });
    return byUrl ? sv.ctx.net.fetch(req) : peer.fetch(req);
  });
  if (sent.ok) return { response: sent.value, route: undefined, diags: [] };
  const failure = unexpected(`peer unreachable: ${sent.error.message}`);
  return { ...crashed(sv.mode, failure, 502), diags: [failure] };
}
