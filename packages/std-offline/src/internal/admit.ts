import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { tx } from "@keel/store";
import type { Config } from "./Config.ts";
import { fault } from "./fault.ts";
import { persist } from "./persist.ts";

/**
 * Writes the outbox to `ctx.storage` for entry `key`, made `queued` in memory a moment before, and holds that entry
 * back from a running flush (`c.writes`) until the write settles. A write that rejects (or times out, `persist`) leaves
 * the entry `failed` with `offline.storage` before the flush sees it again, writes the outbox once more (best effort)
 * and resolves that error; a write that lands resolves undefined.
 */
export function admit(
  ctx: Ctx,
  c: Config,
  key: string,
): Promise<ReturnType<typeof fault<"offline.storage">> | undefined> {
  const written = attempt(() => persist(ctx, c)).then(async (stored) => {
    c.writes.delete(key);
    if (stored.ok) return undefined;
    const error = fault(c, "offline.storage");
    tx(c.settle, { key, state: "failed", error });
    await attempt(() => persist(ctx, c));
    return error;
  });
  c.writes.set(key, written);
  return written;
}
