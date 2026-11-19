import type { Ctx } from "@keel/ctx";
import type { Config } from "./Config.ts";

/** Writes the outbox's entries to `ctx.storage` under `keel.outbox.<id>` as `{ entries }` JSON. */
export function persist(ctx: Ctx, c: Config): Promise<void> {
  return ctx.storage.set(`keel.outbox.${c.id}`, JSON.stringify({ entries: c.store.get("entries") }));
}
