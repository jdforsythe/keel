import { type PluginListenerHandle, registerPlugin } from "@capacitor/core";
import type { Net } from "@keel/ctx";
import type { Hop } from "./Hop.ts";
import { allows } from "./allows.ts";
import { followRedirects } from "./followRedirects.ts";
import { mapUrl } from "./mapUrl.ts";
import { online } from "./online.ts";
import { pageOf } from "./pageOf.ts";

/** A body event of the native plugin: `chunk` carries `data` (base64), `end` and `fail` only the `id`. */
interface BodyEvent {
  readonly id: string;
  readonly data?: string;
}
type BodyName = "chunk" | "end" | "fail";
/**
 * The package's native plugin (`android/`, `ios/`): one request per `id`, its body as events. It follows no redirect
 * and rejects a URL whose origin its `allow` configuration does not list; `redirect: 'manual'` says so to a client
 * that would follow.
 */
interface KeelHttp {
  request(o: {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    data?: string | undefined;
    redirect: "manual";
  }): Promise<{ status: number; headers: Record<string, string> }>;
  cancel(o: { id: string }): Promise<void>;
  addListener(name: BodyName, cb: (e: BodyEvent) => void): Promise<PluginListenerHandle>;
}

const EMPTY = [204, 205, 304];
let seq = 0;

/** One native response: its head, its body as it arrives, and `stop`, which lets go of it without cancelling. */
type Got = {
  readonly status: number;
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array>;
  readonly stop: () => void;
};

/**
 * k.shell's net on the package's native plugin `KeelHttp`: the request goes through the native HTTP client, whose cookie
 * store keeps every cookie and sends it to its own origin only; `set-cookie` never reaches the page. A request on the
 * page's origin goes to `origin`, and with none is refused before any native call; the driver sends only to `origin`
 * and the `connect` origins and follows redirects
 * itself, one unfollowed native request per hop, each held to that list (`followRedirects`). The response
 * resolves on its headers and its body yields each chunk as it arrives; an abort or a reader's cancel cancels the native
 * request. The body's listeners are added before the request is sent and removed when the body ends, fails or is
 * cancelled, or its response is a redirect the driver follows. The global `fetch` stays unpatched. A failure, a refused
 * URL included, rejects with a `TypeError` that names no URL; an aborted request with the signal's reason.
 */
export function capacitorNet(origin: URL | undefined, connect: readonly string[] = []): Net {
  const http = registerPlugin<KeelHttp>("KeelHttp");
  const send = async (hop: Hop, data: string, signal: AbortSignal): Promise<Got> => {
    const id = `${++seq}`;
    let subs: Promise<PluginListenerHandle>[] = [];
    let open = true;
    const stop = (): void => {
      open = false;
      for (const s of subs) void s.then((h) => h.remove());
    };
    const quit = (): void => {
      if (open) {
        stop();
        void http.cancel({ id });
      }
    };
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const on = (name: BodyName, f: (e: BodyEvent) => void) =>
          http.addListener(name, (e) => {
            if (open && e.id === id) f(e);
          });
        subs = [
          on("chunk", (e) => c.enqueue(Uint8Array.from(atob(e.data ?? ""), (ch) => ch.charCodeAt(0)))),
          on("end", () => {
            stop();
            c.close();
          }),
          on("fail", () => {
            stop();
            c.error(new TypeError("network request failed"));
          }),
        ];
        signal.addEventListener("abort", () => {
          if (open) c.error(signal.reason);
          quit();
        });
      },
      cancel: quit,
    });
    try {
      await Promise.all(subs);
      const res = await http.request({
        id,
        url: hop.url,
        method: hop.method,
        headers: Object.fromEntries(hop.headers),
        data: hop.body && data !== "" ? data : undefined,
        redirect: "manual",
      });
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (k.toLowerCase() !== "set-cookie") headers.append(k, v);
      return { status: res.status, headers, body, stop };
    } catch {
      quit();
      throw signal.aborted ? signal.reason : new TypeError("network request failed");
    }
  };
  return {
    fetch: async (req) => {
      const url = mapUrl(req.url, origin, pageOf());
      if (url === undefined) throw new TypeError("network request failed");
      const signal = req.signal;
      const data = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
      const first = { url, method: req.method, headers: req.headers, body: true };
      const got = await followRedirects(
        first,
        req.redirect,
        (url) => allows(url, origin, connect),
        (hop) => send(hop, data, signal),
        (res) => res.stop(),
      );
      return new Response(EMPTY.includes(got.status) ? null : got.body, { status: got.status, headers: got.headers });
    },
    online,
  };
}
