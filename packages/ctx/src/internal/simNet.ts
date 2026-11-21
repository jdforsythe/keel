import type { Clock } from "../Clock.ts";
import type { NetStep } from "../NetStep.schema.ts";
import type { RouteHandler } from "../RouteHandler.ts";
import type { SimNet } from "../SimNet.ts";
import { matchRoute } from "./matchRoute.ts";

const failed = (why = "offline"): TypeError => new TypeError(`sim net: ${why}`);
const NO_STEP: NetStep = { delay: 0, fault: "none" };

/**
 * In-memory route table. Unmatched requests resolve a 404 whose body names the URL. A route's body is relayed through
 * a stream the net can error, so going offline errors every body still open. `changed` hears each connectivity change.
 * The n-th fetch takes `steps[n]` when it is made (k.sim): it waits `delay` on `clock`, then `drop` rejects and
 * `unavailable` resolves a 503 without running the route, and `lost` runs the route and rejects.
 */
export function simNet(changed: (online: boolean) => void, clock: Clock, steps: readonly NetStep[] = []): SimNet {
  const routes: { readonly pattern: string; readonly handler: RouteHandler }[] = [];
  const open = new Set<(error: TypeError) => void>();
  let up = true;
  let n = 0;
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
      const step = steps[n++] ?? NO_STEP;
      if (!up) throw failed();
      if (step.delay > 0) {
        await clock.after(step.delay);
        if (!up) throw failed();
      }
      if (step.fault === "drop") throw failed("dropped");
      if (step.fault === "unavailable") return new Response(null, { status: 503 });
      const hit = routes.find((r) => matchRoute(r.pattern, req.url));
      const res =
        hit === undefined
          ? new Response(`sim net: no route for ${req.method} ${req.url}`, { status: 404 })
          : await hit.handler(req);
      if (step.fault === "lost") throw failed("response lost");
      if (!up) throw failed();
      return hit === undefined ? res : relay(res);
    },
    online: () => up,
    setOnline: (online) => {
      if (online === up) return;
      up = online;
      if (!online) for (const kill of [...open]) kill(failed());
      if (!online) open.clear();
      changed(online);
    },
  };
}
