import type { Ctx } from "@keel/ctx";
import { computed, owner, signal } from "@keel/reactive";
import { type Result, attempt } from "@keel/schema";
import { type Channel, subscribe } from "@keel/std-channels";
import { type Transaction, tx } from "@keel/store";
import type { LiveStatus } from "./LiveStatus.schema.ts";

const FIRST_MS = 1000;
const MAX_MS = 30_000;
const BOUND_MS = 30_000;

/**
 * Keep a client store current (std.live), inside a scope (E1203 outside one): follow `channel` with `params` at
 * `origin` and, after each `reset` and each `saved` event, run `read(ctx)` and commit an `ok` value with
 * `tx(hydrate, value)`. One read at a time: a read is pending until it settles or 30 s pass on `ctx.clock`, and events
 * while one is pending cause exactly one more after it. A read that fails or is not settled within 30 s commits nothing
 * and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event; a read settling after its 30 s
 * changes nothing. Disposing the scope closes the stream, ends the waits and drops the result of a read in flight.
 * Returns the status read.
 */
export function live<C extends Ctx, T, P, Q, M, E>(
  ctx: C,
  origin: string,
  channel: Channel<Q, M>,
  params: Q,
  opts: { readonly read: (ctx: C) => Promise<Result<P, E>>; readonly hydrate: Transaction<T, P> },
): () => LiveStatus {
  const sc = owner();
  if (sc === undefined) throw new Error("E1203: live() called outside any scope; wrap it in scope(fn)");
  const fresh = signal(false);
  let alive = true;
  let reading = false;
  let again = false;
  let delay = FIRST_MS;
  let retry = new AbortController();
  let bound = new AbortController();
  const read = async (): Promise<void> => {
    retry.abort();
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    again = false;
    const b = new AbortController();
    bound = b;
    const bounded = attempt(() => ctx.clock.after(BOUND_MS, b.signal)).then(() => undefined);
    const r = await Promise.race([attempt(() => opts.read(ctx)), bounded]);
    b.abort();
    reading = false;
    if (!alive) return;
    const done = r?.ok === true && r.value.ok && tx(opts.hydrate, r.value.value).ok;
    fresh.set(done);
    delay = done ? FIRST_MS : delay;
    if (again) return void read();
    if (done) return;
    const t = new AbortController();
    retry = t;
    const wait = attempt(() => ctx.clock.after(delay, t.signal));
    delay = Math.min(delay * 2, MAX_MS);
    if ((await wait).ok && sub.status() === "open") void read();
  };
  const sub = subscribe(ctx, origin, channel, params, (e) => {
    if (e.kind === "reset") fresh.set(false);
    if (e.kind === "reset" || e.kind === "saved") void read();
  });
  sc.onDispose(() => {
    alive = false;
    retry.abort();
    bound.abort();
  });
  const status = computed((): LiveStatus => {
    const s = sub.status();
    return s === "open" ? (fresh.get() ? "live" : "connecting") : s;
  });
  return status.get;
}
