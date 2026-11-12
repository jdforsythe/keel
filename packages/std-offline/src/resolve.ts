import type { Ctx } from "@keel/ctx";
import type { EndpointMap } from "@keel/services";
import { tx } from "@keel/store";
import type { Outbox } from "./Outbox.type.ts";
import type { Resolution } from "./Resolution.schema.ts";
import { configOf } from "./internal/configOf.ts";
import { flush } from "./internal/flush.ts";
import { persist } from "./internal/persist.ts";

/**
 * Answer a refused entry (std.offline Resolve): `'mine'` queues a `conflict` entry again, last, with `base` set to its
 * `head`, and flushes; `'theirs'` removes a `conflict` or `failed` entry. Each logs `<id>.resolve` `{ key, resolution }`
 * and writes the outbox to `ctx.storage`. Resolves false, changing nothing, for a key with no such entry.
 */
export async function resolve(ctx: Ctx, o: Outbox<EndpointMap>, key: string, resolution: Resolution): Promise<boolean> {
  const c = configOf(o);
  const state = c.store.get("entries").find((e) => e.key === key)?.state;
  if (state !== "conflict" && (resolution === "mine" || state !== "failed")) return false;
  tx(c.resolve, { key, resolution });
  await persist(ctx, c);
  if (resolution === "mine") void flush(ctx, c);
  return true;
}
