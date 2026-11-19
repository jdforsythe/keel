import { CapacitorHttp } from "@capacitor/core";
import type { Net } from "@keel/ctx";
import { mapUrl } from "./mapUrl.ts";
import { online } from "./online.ts";
import { pageOf } from "./pageOf.ts";

const EMPTY = [101, 103, 204, 205, 304];

/**
 * k.shell's net on `CapacitorHttp`: the request goes through the native HTTP client, whose cookie store keeps every
 * cookie and sends it to its own origin only; `set-cookie` never reaches the page. The global `fetch` stays unpatched.
 * A failure rejects with a `TypeError` that names no URL.
 */
export function capacitorNet(origin: URL): Net {
  return {
    fetch: async (req) => {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
      let res: Awaited<ReturnType<typeof CapacitorHttp.request>>;
      try {
        res = await CapacitorHttp.request({
          url: mapUrl(req.url, origin, pageOf()),
          method: req.method,
          headers,
          data: text === "" ? undefined : text,
          responseType: "text",
        });
      } catch {
        throw new TypeError("network request failed");
      }
      const out = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (k.toLowerCase() !== "set-cookie") out.append(k, v);
      const data: unknown = res.data;
      const body = typeof data === "string" ? data : JSON.stringify(data ?? "");
      return new Response(EMPTY.includes(res.status) ? null : body, { status: res.status, headers: out });
    },
    online,
  };
}
