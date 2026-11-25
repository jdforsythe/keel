import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { Config } from "./Config.ts";
import { flowOf } from "./flowOf.ts";

/**
 * Writes the outbox's entries that `ctx` holds to `ctx.storage` under `keel.outbox.<id>` as `{ entries }` JSON. A `set` that throws
 * rejects, as does a write not settled 10 s after it began on `ctx.clock`; the timer is cancelled when the write
 * settles, and a clock that throws leaves the write unbounded. A write given up at that bound that lands later is
 * followed by one more write of the outbox as memory then holds it.
 */
export async function persist(ctx: Ctx, c: Config): Promise<void> {
  const stop = new AbortController();
  let gone = false;
  const { held, kept } = flowOf(c, ctx);
  const entries = [...c.store.get("entries").filter((e) => held.has(e.key)), ...kept];
  const set = ctx.storage.set(`keel.outbox.${c.id}`, JSON.stringify({ entries }));
  set.then(
    () => void (gone && attempt(() => persist(ctx, c))),
    () => undefined,
  );
  return Promise.race([
    set,
    new Promise<void>((_, late) => {
      Promise.resolve()
        .then(() => ctx.clock.after(10_000, stop.signal))
        .then(
          () => {
            gone = true;
            late();
          },
          () => undefined,
        );
    }),
  ]).finally(() => stop.abort());
}
