import type { RouteHandler } from "../RouteHandler.ts";
import type { SimNet } from "../SimNet.ts";
import { matchRoute } from "./matchRoute.ts";

const offline = (): TypeError => new TypeError("sim net: offline");

/**
 * In-memory route table. Unmatched requests resolve a 404 whose body names the URL. A route's body is relayed through
 * a stream the net can error, so going offline errors every body still open. `changed` hears each connectivity change.
 */
export function simNet(changed: (online: boolean) => void): SimNet {
  const routes: { readonly pattern: string; readonly handler: RouteHandler }[] = [];
  const open = new Set<(error: TypeError) => void>();
  let up = true;
  const relay = (res: Response): Response => {
    const reader = res.body?.getReader();
    if (reader === undefined) return res;
    const kill = { fn: (_: TypeError): void => {} };
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        kill.fn = (error) => {
          c.error(error);
          reader.cancel(error).catch(() => {});
        };
        open.add(kill.fn);
      },
      async pull(c) {
        const next = await reader.read();
        if (!next.done) return c.enqueue(next.value);
        open.delete(kill.fn);
        c.close();
      },
      cancel(reason) {
        open.delete(kill.fn);
        return reader.cancel(reason);
      },
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
  return {
    route: (pattern, handler) => {
      routes.push({ pattern, handler });
    },
    fetch: async (req) => {
      if (!up) throw offline();
      const hit = routes.find((r) => matchRoute(r.pattern, req.url));
      if (hit === undefined) return new Response(`sim net: no route for ${req.method} ${req.url}`, { status: 404 });
      const res = await hit.handler(req);
      if (!up) throw offline();
      return relay(res);
    },
    online: () => up,
    setOnline: (online) => {
      if (online === up) return;
      up = online;
      if (!online) for (const kill of [...open]) kill(offline());
      if (!online) open.clear();
      changed(online);
    },
  };
}
