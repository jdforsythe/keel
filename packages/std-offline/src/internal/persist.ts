import type { Ctx } from "@keel/ctx";
import { type Result, attempt, err, ok } from "@keel/schema";
import type { Config } from "./Config.ts";
import { Failed } from "./Failed.schema.ts";
import { flowOf } from "./flowOf.ts";
import { storageFailed } from "./storageFailed.ts";

/**
 * Writes the outbox's entries that `ctx` holds to `ctx.storage` under `keel.outbox.<id>` as `{ entries }` JSON. A `set` that rejects,
 * with any value (`storageFailed`), is `offline.failed`, as is a write not settled 10 s after it began on `ctx.clock`; the timer is cancelled when the write
 * settles, and a clock that throws leaves the write unbounded. A write given up at that bound that lands later is
 * followed by one more write of the outbox as memory then holds it.
 */
export async function persist(ctx: Ctx, c: Config): Promise<Result<null, ReturnType<typeof Failed.make>>> {
  const stop = new AbortController();
  let gone = false;
  const { held, kept } = flowOf(c, ctx);
  const entries = [...c.store.get("entries").filter((e) => held.has(e.key)), ...kept];
  const text = JSON.stringify({ entries });
  const written = attempt(async () => {
    await ctx.storage.set(`keel.outbox.${c.id}`, text);
    return null;
  }, storageFailed);
  // The write after a late landing is the last one tried: when it fails too, storage keeps what landed last.
  void written.then(async (w) => (w.ok && gone ? (await persist(ctx, c)).ok : false));
  const bound = new Promise<Result<null, ReturnType<typeof Failed.make>>>((late) => {
    void attempt(
      async () => {
        await Promise.resolve();
        await ctx.clock.after(10_000, stop.signal);
      },
      (x) => (x instanceof Error ? Failed.make({}) : undefined),
    ).then((waited) => {
      if (!waited.ok) return;
      gone = true;
      late(err(Failed.make({})));
    });
  });
  return Promise.race([written, bound]).finally(() => stop.abort());
}
