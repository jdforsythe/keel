import { attempt } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Peer } from "./Peer.ts";
import type { Served } from "./Served.ts";
import { crashed } from "./crashed.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { readCapped } from "./readCapped.ts";
import { stripHop } from "./stripHop.ts";
import { unexpected } from "./unexpected.ts";

/**
 * Forward `raw` to `peer` (k.topology Calls and peers): method, path, search, body and headers but hop-by-hop ones
 * (`stripHop`), plus `x-keel-forwarded: 1`. A peer by URL gets the request at that URL's
 * origin plus the path and search, through `ctx.net.fetch`; an in-process peer at the request's own URL. Redirects are
 * not followed, so the peer's response, a 3xx with its `location` and `set-cookie` too, comes back as is but for `stripHop` and `content-encoding` (the body arrives decoded). A body over
 * `maxBody` is 413 `keel.payloadTooLarge` and nothing is sent; a peer that cannot be reached is 502 `keel.unexpected`
 * with one `diag`.
 */
export async function forward(raw: Request, peer: Peer, sv: Served): Promise<Handled> {
  const url = new URL(raw.url);
  const headers = stripHop(raw.headers);
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
  if (sent.ok) {
    const { status, statusText, body: stream } = sent.value;
    const headers = stripHop(sent.value.headers, ["content-encoding"]);
    return { response: new Response(stream, { status, statusText, headers }), route: undefined, diags: [] };
  }
  const failure = unexpected(`peer unreachable: ${sent.error.message}`);
  return { ...crashed(sv.mode, failure, 502), diags: [failure] };
}
