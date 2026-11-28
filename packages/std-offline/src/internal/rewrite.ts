import type { Ctx } from "@keel/ctx";
import type { Config } from "./Config.ts";
import { persist } from "./persist.ts";

/**
 * Writes the outbox once more where memory already holds the answer (std.outbox Storage writes, What storage holds): a
 * fault already settled as `offline.storage`, an entry loaded or made `failed` with `offline.owner`. When this write
 * fails too, storage keeps the state of the write that landed last and memory is unchanged, so there is no one to tell.
 * Resolves whether it landed.
 */
export async function rewrite(ctx: Ctx, c: Config): Promise<boolean> {
  const r = await persist(ctx, c);
  return r.ok;
}
