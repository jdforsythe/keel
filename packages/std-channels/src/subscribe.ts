import { type Ctx, observe } from "@keel/ctx";
import { owner, signal } from "@keel/reactive";
import { attempt } from "@keel/schema";
import type { Channel } from "./Channel.type.ts";
import type { ChannelEvent } from "./ChannelEvent.ts";
import type { ChannelStatus } from "./ChannelStatus.ts";
import type { Subscription } from "./Subscription.ts";
import { Rejected } from "./internal/Rejected.schema.ts";
import { apiOf } from "./internal/apiOf.ts";

const FIRST_MS = 1000;
const MAX_MS = 30_000;

/**
 * Follow `channel` with `params` at `origin` (std.channels Client), inside a scope: reads its event stream through a
 * k.services `events` endpoint and calls `on` for each `ok` event. When a stream ends (a drop, `api.network`,
 * `closed` `full`) it reopens 1 s later, doubling to 30 s on `ctx.clock`; a `reset` starts the doubling over. `status()`
 * is `open` from a stream's `reset` until that stream ends, and `connecting` from then until the next `reset`. While
 * `ctx.net.online()` is false it sends nothing, aborts an open stream, and reconnects at once on
 * `{ kind: 'net', online: true }`. After `closed` `denied` it stops. Disposing the scope, or `close()`, aborts the
 * request; `on` gets no later event. The stream starts after the current tick, so subscribing while rendering inside
 * an effect writes nothing.
 */
export function subscribe<P, M>(
  ctx: Ctx,
  origin: string,
  channel: Channel<P, M>,
  params: P,
  on: (event: ChannelEvent<M>) => void,
): Subscription {
  const api = apiOf(origin, channel);
  const status = signal<ChannelStatus>(ctx.net.online() ? "connecting" : "offline");
  const life = new AbortController();
  let wake = (): void => undefined;
  let back = false;
  let req = new AbortController();
  const stop = observe(ctx, (e) => {
    if (e.kind !== "net" || life.signal.aborted) return;
    if (e.online) {
      back = true;
      return wake();
    }
    status.set("offline");
    req.abort();
  });
  const close = (): void => {
    life.abort();
    req.abort();
    wake();
    stop();
  };
  /** Resolves after `ms` on `ctx.clock` (no `ms`: never), or at once on `wake` or when the net came back meanwhile. */
  const pause = async (ms?: number): Promise<void> => {
    const w = new AbortController();
    wake = () => w.abort();
    if (life.signal.aborted || back) return;
    await (ms === undefined
      ? new Promise<void>((r) => w.signal.addEventListener("abort", () => r()))
      : attempt(
          () => ctx.clock.after(ms, w.signal),
          (x) => (x === w.signal.reason ? Rejected.make({}) : undefined),
        ));
  };
  const run = async (): Promise<void> => {
    let delay = FIRST_MS;
    while (!life.signal.aborted) {
      if (!ctx.net.online()) {
        status.set("offline");
        back = false;
        await pause();
        continue;
      }
      status.set("connecting");
      back = false;
      req = new AbortController();
      for await (const r of api.events({ query: params, signal: req.signal }, ctx)) {
        if (life.signal.aborted || !r.ok) break;
        const e = r.value;
        if (e.kind === "reset") {
          delay = FIRST_MS;
          status.set("open");
        }
        if (e.kind === "closed" && e.reason === "denied") {
          status.set("denied");
          on(e);
          return close();
        }
        on(e);
        if (e.kind === "closed") break;
      }
      req.abort();
      if (life.signal.aborted || !ctx.net.online()) continue;
      // The stream ended: nothing is open while it waits to reopen.
      status.set("connecting");
      await pause(delay);
      delay = Math.min(MAX_MS, delay * 2);
    }
  };
  owner()?.onDispose(close);
  // Started after the current tick: a caller rendering inside an effect makes no write (the status starts at its
  // initial value).
  void Promise.resolve().then(run);
  return { status: status.get, close };
}
