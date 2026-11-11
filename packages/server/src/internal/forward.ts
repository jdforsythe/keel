import type { Ctx } from "@keel/ctx";
import type { Peer } from "./Peer.ts";

/**
 * Forward `raw` to `peer` unchanged (k.topology Calls and peers): method, path, search, headers but `host`, plus
 * `x-keel-forwarded: 1`, and body; an in-process peer gets it at the request's own URL, a peer by URL through
 * `ctx.net.fetch`. Its response is returned as is.
 */
export async function forward(raw: Request, peer: Peer, ctx: Ctx): Promise<Response> {
  const url = new URL(raw.url);
  const headers = new Headers(raw.headers);
  headers.delete("host");
  headers.set("x-keel-forwarded", "1");
  const bodied = raw.method !== "GET" && raw.method !== "HEAD";
  const body = bodied ? await raw.arrayBuffer() : null;
  const at = typeof peer === "string" || peer instanceof URL ? new URL(`${url.pathname}${url.search}`, peer) : url;
  const req = new Request(at, { method: raw.method, headers, body, signal: raw.signal });
  return typeof peer === "string" || peer instanceof URL ? ctx.net.fetch(req) : peer.fetch(req);
}
