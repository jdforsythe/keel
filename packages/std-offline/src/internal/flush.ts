import type { Ctx } from "@keel/ctx";
import { err } from "@keel/schema";
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
 * running. A network failure keeps the entry queued, stops, and retries 1 s later doubling to 60 s on `ctx.clock`
 * while online. Resolves the settlement of entry `key`, or `queued` when the flush stops before it.
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
  for (;;) {
    const e = c.store.get("entries").find((x) => x.state === "queued");
    if (!c.live || !ctx.net.online() || e === undefined) break;
    await put(e.key, "sending", {});
    const call = service({ base: e.origin, schema: c.api })[e.endpoint];
    const body = { ...obj(field(e.input, "body")), write: { key: e.key, base: e.base } };
    const r = call
      ? await call({ params: field(e.input, "params"), query: field(e.input, "query"), body }, ctx)
      : err({ code: "api.input" as const, message: e.endpoint, data: { issues: [] } });
    const out = outcomeOf(r, c.again === e.key);
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
      c.waits.get(e.key)?.(out);
      c.waits.delete(e.key);
    }
  }
  c.busy = false;
  for (const go of c.waits.values()) go({ state: "queued" });
  c.waits.clear();
}
