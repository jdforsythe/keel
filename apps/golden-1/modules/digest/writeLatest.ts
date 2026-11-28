import type { Ctx } from "@keel/ctx";
import type { Digest } from "./Digest.schema.ts";
import { LATEST_KEY } from "./LATEST_KEY.ts";

/** Store `digest` as the newest digest (`readLatest` reads it back). */
export async function writeLatest(ctx: Ctx, digest: Digest): Promise<void> {
  await ctx.storage.set(LATEST_KEY, JSON.stringify(digest));
}
