import type { Loader } from "@keel/router";
import type { Match } from "@keel/router/internal";
import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import { openStores } from "./openStores.ts";
import { publicError } from "./publicError.ts";

const HEARTBEAT_MS = 15_000;

/**
 * The event stream of a live loader (k.server Request flow), after its guards passed: its `stores` factory opens
 * once and nothing saves; each yield is one `data:` line, its `Result` JSON (`ok` encoded by `output`, `err` as it may
 * leave the server); a `:` line goes out per 15 s of `ctx.clock`. It ends when `fn` returns or its `signal` aborts:
 * on request abort, on `close()`, or when the reader cancels. Written with Hono's `streamSSE`; `cache-control: no-store`.
 */
export function liveStream(r: Req, m: Match & { kind: "route" }, live: Loader<unknown>, c: Context): Handled {
  const { sv, rq, raw } = r;
  const ac = new AbortController();
  const stop = (): void => ac.abort();
  raw.signal.addEventListener("abort", stop, { once: true });
  sv.lifecycle.signal.addEventListener("abort", stop, { once: true });
  const ended = new Promise<undefined>((resolve) => ac.signal.addEventListener("abort", () => resolve(undefined)));
  const response = streamSSE(c, async (stream) => {
    stream.onAbort(stop);
    const beat = (async () => {
      while ((await attempt(() => sv.ctx.clock.after(HEARTBEAT_MS, ac.signal))).ok) await stream.write(":\n\n");
    })();
    let it: AsyncIterator<Result<unknown, KeelError<string, unknown>>> | undefined;
    try {
      const stores = live.stores === undefined ? undefined : await openStores(sv, rq, live.stores);
      const args = { params: m.params, search: m.search, url: r.url, caller: rq.caller.id, stores, signal: ac.signal };
      it = live.live?.(args, sv.ctx)[Symbol.asyncIterator]();
      while (it !== undefined) {
        const next = await Promise.race([it.next(), ended]);
        if (next === undefined || next.done === true) break;
        const res = next.value;
        const json = res.ok
          ? attempt(() => ok(live.output.encode(res.value)))
          : ok(err(publicError(res.error, sv.mode)));
        await stream.writeSSE({ data: JSON.stringify(json.ok ? json.value : err(publicError(json.error, sv.mode))) });
      }
    } finally {
      stop();
      raw.signal.removeEventListener("abort", stop);
      sv.lifecycle.signal.removeEventListener("abort", stop);
      void it?.return?.().catch(() => undefined);
      await beat;
    }
  });
  response.headers.set("cache-control", "no-store");
  return { response, route: m.route.id, diags: [] };
}
