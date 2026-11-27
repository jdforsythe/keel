import type { Ctx } from "@keel/ctx";
import { computed, owner, signal } from "@keel/reactive";
import { type KeelError, type Result, attempt, defect } from "@keel/schema";
import { type Channel, subscribe } from "@keel/std-channels";
import { type Transaction, tx } from "@keel/store";
import type { LiveStatus } from "./LiveStatus.schema.ts";
import { Rejected } from "./Rejected.ts";

const FIRST_MS = 1000;
const MAX_MS = 30_000;
const BOUND_MS = 30_000;

/** A refused read's error: `api.status` 401 or 403 (k.services), or `keel.denied` from a direct loader call. */
const refused = (e: unknown): boolean => {
  const code: unknown = Reflect.get(Object(e), "code");
  const status: unknown = Reflect.get(Object(Reflect.get(Object(e), "data")), "status");
  return code === "keel.denied" || (code === "api.status" && (status === 401 || status === 403));
};

/**
 * Keep a client store current (std.live), inside a scope (E1203 outside one): follow `channel` with `params` at
 * `origin` and, after each `reset`, `saved` and `changed` event, run `read(ctx, signal)` and commit an `ok` value with
 * `tx(hydrate, value)`. One read at a time: a read is pending until it settles or 30 s pass on `ctx.clock`, and events
 * while one is pending cause exactly one more after it. A read that fails or is not settled within 30 s commits nothing
 * and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event; a read settling after its 30 s
 * changes nothing. `signal` aborts when a read's 30 s pass while it is pending and when the scope is disposed while it is
 * pending; a `read` that takes only `ctx` stays valid. Disposing the scope closes the stream, ends the waits and drops
 * the result of a read in flight. A refused read (`refused`) commits nothing, closes the stream and stops reading:
 * the status is `denied` from then on.
 * Returns the status read.
 */
export function live<C extends Ctx, T, P, Q, M, E extends KeelError<string, unknown>>(
  ctx: C,
  origin: string,
  channel: Channel<Q, M>,
  params: Q,
  opts: { readonly read: (ctx: C, signal: AbortSignal) => Promise<Result<P, E>>; readonly hydrate: Transaction<T, P> },
): () => LiveStatus {
  const sc = owner();
  if (sc === undefined) return defect("live() called outside any scope; wrap it in scope(fn)", "E1203");
  const fresh = signal(false);
  const denied = signal(false);
  let alive = true;
  let reading = false;
  let again = false;
  let delay = FIRST_MS;
  let retry = new AbortController();
  let bound = new AbortController();
  let sig = new AbortController();
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
    const s = new AbortController();
    sig = s;
    const bounded = attempt(
      () => ctx.clock.after(BOUND_MS, b.signal),
      (x) => (x === b.signal.reason ? Rejected.make({}) : undefined),
    ).then((w) => {
      if (w.ok) s.abort();
    });
    // The read's `Result` rides in an object so `attempt` hands it back whole, not as its own.
    const pending = attempt(
      async () => ({ got: await opts.read(ctx, s.signal) }),
      (x) => (x instanceof Error ? Rejected.make({}) : undefined),
    );
    const r = await Promise.race([pending, bounded]);
    b.abort();
    reading = false;
    if (!alive) return;
    if (r?.ok === true && !r.value.got.ok && refused(r.value.got.error)) {
      alive = false;
      denied.set(true);
      return sub.close();
    }
    const done = r?.ok === true && r.value.got.ok && tx(opts.hydrate, r.value.got.value).ok;
    fresh.set(done);
    delay = done ? FIRST_MS : delay;
    if (again) return void read();
    if (done) return;
    const t = new AbortController();
    retry = t;
    const wait = attempt(
      () => ctx.clock.after(delay, t.signal),
      (x) => (x === t.signal.reason ? Rejected.make({}) : undefined),
    );
    delay = Math.min(delay * 2, MAX_MS);
    if ((await wait).ok && sub.status() === "open") void read();
  };
  const sub = subscribe(ctx, origin, channel, params, (e) => {
    if (e.kind === "reset") fresh.set(false);
    if (e.kind === "reset" || e.kind === "saved" || e.kind === "changed") void read();
  });
  sc.onDispose(() => {
    alive = false;
    retry.abort();
    bound.abort();
    sig.abort();
  });
  const status = computed((): LiveStatus => {
    const s = sub.status();
    if (denied.get()) return "denied";
    return s === "open" ? (fresh.get() ? "live" : "connecting") : s;
  });
  return status.get;
}
