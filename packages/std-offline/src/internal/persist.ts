import type { Ctx } from "@keel/ctx";
import type { Config } from "./Config.ts";

/**
 * Writes the outbox's entries to `ctx.storage` under `keel.outbox.<id>` as `{ entries }` JSON. A write not settled
 * 10 s after it began on `ctx.clock` rejects; the timer is cancelled when the write settles, and a clock that throws
 * leaves the write unbounded.
 */
export function persist(ctx: Ctx, c: Config): Promise<void> {
  const stop = new AbortController();
  return Promise.race([
    ctx.storage.set(`keel.outbox.${c.id}`, JSON.stringify({ entries: c.store.get("entries") })),
    new Promise<void>((_, late) => {
      Promise.resolve()
        .then(() => ctx.clock.after(10_000, stop.signal))
        .then(late, () => undefined);
    }),
  ]).finally(() => stop.abort());
}
