import type { Ctx } from "@keel/ctx";
import type { Config } from "./Config.ts";
import { apply } from "./apply.ts";
import { fault } from "./fault.ts";
import { flowOf } from "./flowOf.ts";
import { rewrite } from "./rewrite.ts";

/**
 * Makes `owner` the owner of outbox `c` on `ctx` and ends a pause of its flush. A named owner fails every entry the ctx
 * holds of another owner that is not `failed` with `offline.owner`, and the outbox is written to `ctx.storage` when any did;
 * afterwards each entry that is not `failed` is `owner`'s. A rejected write leaves those entries `failed` in memory.
 * The owner `""` (no one signed in) changes no entry: other owners' entries stay `queued` until their owner returns.
 */
export async function own(ctx: Ctx, c: Config, owner: string): Promise<void> {
  const f = flowOf(c, ctx);
  f.owner = owner;
  f.paused = false;
  if (owner === "") return;
  const { held } = f;
  const others = c.store.get("entries").filter((e) => held.has(e.key) && e.owner !== owner && e.state !== "failed");
  for (const e of others) apply(c.settle, { key: e.key, state: "failed", error: fault(c, "offline.owner") });
  if (others[0]) await rewrite(ctx, c);
}
