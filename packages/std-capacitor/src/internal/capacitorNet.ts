import { type PluginListenerHandle, registerPlugin } from "@capacitor/core";
import type { Net } from "@keel/ctx";
import { mapUrl } from "./mapUrl.ts";
import { online } from "./online.ts";
import { pageOf } from "./pageOf.ts";

/** A body event of the native plugin: `chunk` carries `data` (base64), `end` and `fail` only the `id`. */
interface BodyEvent {
  readonly id: string;
  readonly data?: string;
}
type BodyName = "chunk" | "end" | "fail";
/** The package's native plugin (`android/`, `ios/`): one request per `id`, its body as events. */
interface KeelHttp {
  request(o: {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    data?: string | undefined;
  }): Promise<{ status: number; headers: Record<string, string> }>;
  cancel(o: { id: string }): Promise<void>;
  addListener(name: BodyName, cb: (e: BodyEvent) => void): Promise<PluginListenerHandle>;
}

const EMPTY = [204, 205, 304];
let seq = 0;

/**
 * k.shell's net on the package's native plugin `KeelHttp`: the request goes through the native HTTP client, whose cookie
 * store keeps every cookie and sends it to its own origin only; `set-cookie` never reaches the page. The response
 * resolves on its headers and its body yields each chunk as it arrives; an abort or a reader's cancel cancels the native
 * request. The body's listeners are added before the request is sent and removed when the body ends, fails or is
 * cancelled. The global `fetch` stays unpatched. A failure rejects with a `TypeError` that names no URL; an aborted
 * request with the signal's reason.
 */
export function capacitorNet(origin: URL): Net {
  const http = registerPlugin<KeelHttp>("KeelHttp");
  return {
    fetch: async (req) => {
      const id = `${++seq}`;
      const signal = req.signal;
      const data = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
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
      let res: Awaited<ReturnType<KeelHttp["request"]>>;
      try {
        await Promise.all(subs);
        res = await http.request({
          id,
          url: mapUrl(req.url, origin, pageOf()),
          method: req.method,
          headers: Object.fromEntries(req.headers),
          data: data === "" ? undefined : data,
        });
      } catch {
        quit();
        throw signal.aborted ? signal.reason : new TypeError("network request failed");
      }
      const out = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (k.toLowerCase() !== "set-cookie") out.append(k, v);
      return new Response(EMPTY.includes(res.status) ? null : body, { status: res.status, headers: out });
    },
    online,
  };
}
