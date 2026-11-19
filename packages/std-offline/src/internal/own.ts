import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { tx } from "@keel/store";
import type { Config } from "./Config.ts";
import { fault } from "./fault.ts";
import { persist } from "./persist.ts";

/**
 * Makes `owner` the owner of outbox `c` on `ctx` and ends a pause of its flush. A named owner fails every entry of
 * another owner that is not `failed` with `offline.owner`, and the outbox is written to `ctx.storage` when any did;
 * afterwards each entry that is not `failed` is `owner`'s. A rejected write leaves those entries `failed` in memory.
 * The owner `""` (no one signed in) changes no entry: other owners' entries stay `queued` until their owner returns.
 */
export async function own(ctx: Ctx, c: Config, owner: string): Promise<void> {
  c.owners.set(ctx, owner);
  c.paused.delete(ctx);
  if (owner === "") return;
  const others = c.store.get("entries").filter((e) => e.owner !== owner && e.state !== "failed");
  for (const e of others) tx(c.settle, { key: e.key, state: "failed", error: fault(c, "offline.owner") });
  if (others[0]) await attempt(() => persist(ctx, c));
}
