import type { Ctx } from "@keel/ctx";
import { service } from "@keel/services";
import { tx } from "@keel/store";
import type { OutboxResult } from "../OutboxResult.ts";
import type { Config } from "./Config.ts";
import { field } from "./field.ts";
import { outcomeOf } from "./outcomeOf.ts";
import { persist } from "./persist.ts";

const obj = (x: unknown): object => (typeof x === "object" && x !== null ? x : {});

/**
 * Sends the outbox's `queued` entries in order, one request at a time (std.offline Flush), unless its flush is already
 * running, through a `base` service at the entry's origin whose answers `outcomeOf` reads. A network failure keeps the
 * entry queued, stops, and retries 1 s later doubling to 60 s on `ctx.clock` while online. An entry naming no endpoint
 * of the api is `failed` (`api.input`); a storage write that rejects fails the entry in hand (`offline.storage`) and
 * ends the flush. Resolves the settlement of entry `key`, or `queued` when the flush stops before it.
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
  const put = (key: string, state: string, extra: object): Promise<void> => {
    const payload: unknown = { key, state, ...extra };
    tx(c.settle, payload);
    return persist(ctx, c);
  };
  const done = (key: string, out: OutboxResult<unknown>): void => {
    c.waits.get(key)?.(out);
    c.waits.delete(key);
  };
  let key = "";
  try {
    for (;;) {
      const e = c.store.get("entries").find((x) => x.state === "queued");
      if (!c.live || !ctx.net.online() || e === undefined) break;
      key = e.key;
      await put(e.key, "sending", {});
      const at = Object.hasOwn(c.api, e.endpoint) ? c.api[e.endpoint] : undefined;
      const call = at && service({ base: e.origin, schema: c.wire })[e.endpoint];
      const body = { ...obj(field(e.input, "body")), write: { key: e.key, base: e.base } };
      const out =
        at && call
          ? outcomeOf(
              await call({ params: field(e.input, "params"), query: field(e.input, "query"), body }, ctx),
              c.again === e.key,
              at,
            )
          : {
              state: "failed" as const,
              error: { code: "api.input" as const, message: e.endpoint, data: { issues: [] } },
            };
      c.again = out ? undefined : e.key;
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
      await put(e.key, out?.state ?? "queued", out?.state === "sent" ? {} : { ...out });
      if (out) {
        c.delay = 1000;
        done(e.key, out);
      }
    }
  } catch (x) {
    // A storage write that rejected: the entry in hand is failed in memory, and the flush is released.
    const error = { code: "offline.storage" as const, message: String(x), data: {} };
    tx(c.settle, { key, state: "failed", error });
    done(key, { state: "failed", error });
  }
  c.busy = false;
  for (const go of c.waits.values()) go({ state: "queued" });
  c.waits.clear();
}
