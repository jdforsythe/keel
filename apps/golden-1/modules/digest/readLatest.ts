import type { Ctx } from "@keel/ctx";
import { Digest } from "./Digest.schema.ts";
import { LATEST_KEY } from "./LATEST_KEY.ts";

/** Nothing counted yet. */
const NONE: Digest = { open: 0, done: 0, at: 0 };

/**
 * The newest digest in `ctx.storage`. Before the first count, or when the stored text does not parse as a `Digest`,
 * it is zero counts at time 0: a digest is derived data, and the next `digest.recount` writes it again.
 */
export async function readLatest(ctx: Ctx): Promise<Digest> {
  const raw = await ctx.storage.get(LATEST_KEY);
  if (raw === null) return NONE;
  const parsed = Digest.parseJson(raw);
  return parsed.ok ? parsed.value : NONE;
}
