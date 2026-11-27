import type { Ctx } from "@keel/ctx";
import { tx } from "@keel/store";
import { asResult } from "../unsafe/asResult.ts";
import type { Outbox } from "./Outbox.type.ts";
import type { OutboxResult } from "./OutboxResult.ts";
import type { Resolution } from "./Resolution.schema.ts";
import type { Outputs } from "./internal/Outputs.ts";
import { admit } from "./internal/admit.ts";
import { configOf } from "./internal/configOf.ts";
import { flowOf } from "./internal/flowOf.ts";
import { flush } from "./internal/flush.ts";
import { load } from "./internal/load.ts";
import { persist } from "./internal/persist.ts";

/**
 * Answer a refused entry (std.offline Resolve), once the stored outbox has loaded. `'mine'` queues a `conflict` entry
 * again, last, with `base` set to its `head`, writes the outbox to `ctx.storage` (a running flush does not take the entry
 * until that write settles), flushes, and resolves that entry's
 * `OutboxResult` as `send` does: `queued` when offline or when the flush stops before it, `failed` with
 * `offline.storage` (the entry failed in memory, nothing posted) when the storage write rejects. `'theirs'` removes a
 * `conflict` or `failed` entry, writes the outbox (once more when that write rejects) and resolves true. Each logs `<id>.resolve` `{ key, resolution }`.
 * Resolves false, changing nothing, for a key with no such entry among those the ctx added or loaded.
 */
export function resolve<const D extends object>(
  ctx: Ctx,
  o: Outbox<D>,
  key: string,
  resolution: "mine",
): Promise<false | OutboxResult<Outputs<D>>>;
export function resolve<const D extends object>(
  ctx: Ctx,
  o: Outbox<D>,
  key: string,
  resolution: "theirs",
): Promise<boolean>;
export function resolve<const D extends object>(
  ctx: Ctx,
  o: Outbox<D>,
  key: string,
  resolution: Resolution,
): Promise<boolean | OutboxResult<Outputs<D>>>;
export async function resolve<const D extends object>(
  ctx: Ctx,
  o: Outbox<D>,
  key: string,
  resolution: Resolution,
): Promise<boolean | OutboxResult<Outputs<D>>> {
  const c = configOf(o);
  await load(ctx, c);
  // Only an entry this ctx added or loaded.
  const state = flowOf(c, ctx).held.has(key) ? c.store.get("entries").find((e) => e.key === key)?.state : undefined;
  if (state !== "conflict" && (resolution === "mine" || state !== "failed")) return false;
  void tx(c.resolve, { key, resolution });
  if (resolution === "theirs") {
    flowOf(c, ctx).held.delete(key);
    if (!(await persist(ctx, c)).ok) void (await persist(ctx, c));
    return true;
  }
  const error = await admit(ctx, c, key);
  if (error) return { state: "failed", error };
  return ctx.net.online() ? asResult<Outputs<D>>(await flush(ctx, c, key)) : { state: "queued" };
}
