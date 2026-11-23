import type { Net } from "@keel/ctx";
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import type { Hop } from "./Hop.ts";
import { allows } from "./allows.ts";
import { followRedirects } from "./followRedirects.ts";
import { mapUrl } from "./mapUrl.ts";
import { online } from "./online.ts";
import { pageOf } from "./pageOf.ts";

/**
 * k.shell's net on `@tauri-apps/plugin-http`'s `fetch`: the request goes through the Rust HTTP client, whose cookie
 * store keeps every cookie and sends it to its own origin only; `set-cookie` never reaches the page. A request on the
 * page's origin goes to `origin`; the driver sends only to `origin` and the `connect` origins and follows redirects
 * itself, each hop one request with `maxRedirections: 0` held to that list (`followRedirects`); the body of a response
 * it follows is cancelled. The global `fetch` stays unpatched. A failure, a refused URL included, rejects with a
 * `TypeError` that names no URL; an aborted request with the signal's reason.
 */
export function tauriNet(origin: URL, connect: readonly string[] = []): Net {
  return {
    fetch: async (req) => {
      const body = req.method === "GET" || req.method === "HEAD" ? null : await req.arrayBuffer();
      const send = async (hop: Hop): Promise<Response> => {
        try {
          return await httpFetch(hop.url, {
            method: hop.method,
            headers: hop.headers,
            body: !hop.body || body === null || body.byteLength === 0 ? null : body,
            signal: req.signal,
            maxRedirections: 0,
          });
        } catch {
          throw req.signal.aborted ? req.signal.reason : new TypeError("network request failed");
        }
      };
      const first = { url: mapUrl(req.url, origin, pageOf()), method: req.method, headers: req.headers, body: true };
      const res = await followRedirects(
        first,
        req.redirect,
        (url) => allows(url, origin, connect),
        send,
        (dropped) => void dropped.body?.cancel().catch(() => {}),
      );
      if (!res.headers.has("set-cookie")) return res;
      const headers = new Headers(res.headers);
      headers.delete("set-cookie");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    },
    online,
  };
}
