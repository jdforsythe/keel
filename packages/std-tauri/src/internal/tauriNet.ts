import type { Net } from "@keel/ctx";
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { mapUrl } from "./mapUrl.ts";
import { online } from "./online.ts";
import { pageOf } from "./pageOf.ts";

/**
 * k.shell's net on `@tauri-apps/plugin-http`'s `fetch`: the request goes through the Rust HTTP client, whose cookie
 * store keeps every cookie and sends it to its own origin only; `set-cookie` never reaches the page. A request with
 * `redirect: 'manual'` is sent with `maxRedirections: 0`: its 3xx resolves as it came, `location` included. The global
 * `fetch` stays unpatched. A failure rejects with a `TypeError` that names no URL; an aborted request with the
 * signal's reason.
 */
export function tauriNet(origin: URL): Net {
  return {
    fetch: async (req) => {
      const body = req.method === "GET" || req.method === "HEAD" ? null : await req.arrayBuffer();
      let res: Response;
      try {
        res = await httpFetch(mapUrl(req.url, origin, pageOf()), {
          method: req.method,
          headers: req.headers,
          body: body === null || body.byteLength === 0 ? null : body,
          signal: req.signal,
          ...(req.redirect === "manual" ? { maxRedirections: 0 } : {}),
        });
      } catch {
        throw req.signal.aborted ? req.signal.reason : new TypeError("network request failed");
      }
      if (!res.headers.has("set-cookie")) return res;
      const headers = new Headers(res.headers);
      headers.delete("set-cookie");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    },
    online,
  };
}
