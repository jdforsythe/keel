import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { tx } from "@keel/store";
import type { OutboxResult } from "../OutboxResult.ts";
import type { Config } from "./Config.ts";
import { fault } from "./fault.ts";
import { field } from "./field.ts";
import { outcomeOf } from "./outcomeOf.ts";
import { persist } from "./persist.ts";

const obj = (x: unknown): object => (typeof x === "object" && x !== null ? x : {});
/** The entry waits for its owner: the ctx's owner became `""` before its answer. */
const held: OutboxResult<unknown> = { state: "queued" };
/** The server answered `offline.signin`. */
const paused: OutboxResult<unknown> = { state: "queued" };

/**
 * Sends the outbox's `queued` entries of the ctx's owner in order, one request at a time (std.offline Flush), unless its
 * flush is already running, through the module's service, whose answers `outcomeOf` reads; with no owner given on the
 * ctx it posts nothing. Each post's `body.write` is `{ key, base, owner }` of its entry, and an answer whose error
 * `code` is `offline.owner` (the action refused the owner, std.outbox-owner) fails that entry alone with `offline.owner`,
 * never to be posted again. An entry is posted only while, once its `sending` write settles, it is still `sending` and its
 * owner is the ctx's; otherwise, or when its owner stops being the ctx's while it is in flight and it is not `sent`, it
 * is `failed` with `offline.owner`, unless the ctx's owner became `""`, which leaves it `queued`. An answer whose error
 * `code` is `offline.signin` (the request had no user) leaves the entry `queued` and pauses the flush on that ctx until
 * `send` or `drain` gives an owner again. A network failure keeps the
 * entry queued, stops, and retries 1 s later doubling to 60 s on `ctx.clock` while online. A queued entry whose own
 * storage write (`send`, a `'mine'` `resolve`) has not settled is waited for in its place. An entry naming no endpoint
 * of the api is `failed` (`api.input`). A storage write that rejects or times out fails the entry in hand
 * (`offline.storage`) unless it is the write recording the server's answer (`sent`, `conflict`, `failed`), which then
 * stands and is resolved; either way the outbox is written once more and the flush ends. Any other throw ends the flush, leaves the
 * entries as they are and is rethrown. Resolves the settlement of entry `key`: `failed` with `offline.owner` when
 * another owner failed it before the flush reached it, else `queued` when the flush stops before it.
 */
export function flush(ctx: Ctx, c: Config, key = ""): Promise<OutboxResult<unknown>> {
  const done = new Promise<OutboxResult<unknown>>((go) => c.waits.set(key, go));
  void loop(ctx, c);
  return done;
}

async function loop(ctx: Ctx, c: Config): Promise<void> {
  if (c.busy) return;
  c.busy = true;
  c.timer.abort();
  // Set once a storage write rejects: only that throw fails the entry in hand.
  let lost = false;
  // The answer that settled the entry in hand: a failed write that records it leaves the answer standing.
  let answer: OutboxResult<unknown> | undefined;
  const done = (key: string, out: OutboxResult<unknown>): void => {
    c.waits.get(key)?.(out);
    c.waits.delete(key);
  };
  const put = (key: string, state: string, extra: object, out?: OutboxResult<unknown>): Promise<void> => {
    const payload: unknown = { key, state, ...extra };
    tx(c.settle, payload);
    answer = out;
    return persist(ctx, c).catch((x: unknown) => {
      lost = true;
      throw x;
    });
  };
  const stateOf = (key: string) => c.store.get("entries").find((x) => x.key === key)?.state;
  let key = "";
  try {
    for (;;) {
      const who = c.owners.get(ctx);
      const e = c.store.get("entries").find((x) => x.state === "queued" && x.owner === who);
      if (!c.live || !ctx.net.online() || e === undefined || c.paused.has(ctx)) break;
      // An entry whose own write to `ctx.storage` has not settled: wait for it, then look again (it may be `failed`).
      const writing = c.writes.get(e.key);
      if (writing !== undefined) {
        await writing;
        continue;
      }
      key = e.key;
      answer = undefined;
      await put(e.key, "sending", {});
      if (!c.live) break;
      // A `drain` with another owner may fail the entry at any await: it is posted only while the owner's and `sending`.
      const mine = (): boolean => c.owners.get(ctx) === e.owner && stateOf(e.key) === "sending";
      const gone = { state: "failed" as const, error: fault(c, "offline.owner") };
      const away = (): OutboxResult<unknown> =>
        c.owners.get(ctx) === "" && stateOf(e.key) === "sending" ? held : gone;
      const call = Object.hasOwn(c.api, e.endpoint) ? c.client[e.endpoint] : undefined;
      const body = { ...obj(field(e.input, "body")), write: { key: e.key, base: e.base, owner: e.owner } };
      const got = !mine()
        ? away()
        : call
          ? outcomeOf(
              await call({ params: field(e.input, "params"), query: field(e.input, "query"), body }, ctx),
              c.again === e.key,
              gone,
              paused,
            )
          : {
              state: "failed" as const,
              error: { code: "api.input" as const, message: e.endpoint, data: { issues: [] } },
            };
      // A 2xx answer stands whatever changed in flight: the server committed the write.
      const out = got?.state === "sent" || mine() ? got : away();
      c.again = out ? undefined : e.key;
      if (out === held || out === paused) {
        await put(e.key, "queued", {});
        if (out === held) continue;
        c.paused.add(ctx);
        break;
      }
      if (out?.state === "queued") {
        await put(e.key, "queued", {});
        if (ctx.net.online()) {
          c.timer = new AbortController();
          ctx.clock.after(c.delay, c.timer.signal).then(
            () => loop(ctx, c),
            () => undefined,
          );
        }
        c.delay = Math.min(c.delay * 2, 60_000);
        break;
      }
      await put(e.key, out?.state ?? "queued", out?.state === "sent" ? {} : { ...out }, out);
      if (out) {
        c.delay = 1000;
        done(e.key, out);
      }
    }
  } catch (x) {
    // Any other throw leaves the entries as they are and is rethrown once the flush is released.
    if (!lost) throw x;
    // A storage write that rejected: the entry in hand, unless an answer settled it, is failed in memory; the outbox
    // is written once more (best effort).
    const error = fault(c, "offline.storage");
    if (!answer) tx(c.settle, { key, state: "failed", error });
    await attempt(() => persist(ctx, c));
    done(key, answer ?? { state: "failed", error });
  } finally {
    c.busy = false;
    for (const [k, go] of c.waits)
      go(stateOf(k) === "failed" ? { state: "failed", error: fault(c, "offline.owner") } : { state: "queued" });
    c.waits.clear();
  }
}
