import type { Ctx } from "@keel/ctx";

/** The `ctx.storage` key of the pending opening (k.return Opening). */
const KEY = "keel.return";
/** How long an opening stays pending, in ms of `ctx.clock`. */
const LIFETIME = 600000;
/** What a taken opening leaves in `KEY`: a value that is not an opening. */
const TAKEN = "";

/**
 * The deadline `raw` holds when it is an opening `{"deadline":n}` still pending at `now`, else null. Anything else
 * counts as no opening: unparsable JSON, another shape, a deadline that is not a finite number, one `now` has reached,
 * and one further off than an opening made at `now` could be.
 */
function pendingAt(raw: string, now: number): number | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v) || Object.keys(v).length !== 1) return null;
  if (!("deadline" in v) || typeof v.deadline !== "number" || !Number.isFinite(v.deadline)) return null;
  return now < v.deadline && v.deadline <= now + LIFETIME ? v.deadline : null;
}

/**
 * The openings of a shell's ctx (k.return Opening), kept in `ctx.storage` `keel.return` so they survive a relaunch.
 * `record` makes one pending until 600000 ms after `at` (default `ctx.clock.now()`), replacing any other; it resolves false when storage
 * fails. `take` takes the pending one in one `commit` and resolves true only when this call took it: with none
 * pending, past its deadline, a stored value of another shape, a `commit` another take won, or storage that fails, it
 * resolves false.
 */
export const returnOpenings = {
  async record(ctx: Ctx, at = ctx.clock.now()): Promise<boolean> {
    try {
      await ctx.storage.set(KEY, JSON.stringify({ deadline: at + LIFETIME }));
      return true;
    } catch {
      return false;
    }
  },
  async take(ctx: Ctx): Promise<boolean> {
    try {
      const raw = await ctx.storage.get(KEY);
      if (raw === null || pendingAt(raw, ctx.clock.now()) === null) return false;
      return (await ctx.storage.commit([{ key: KEY, expect: raw, value: TAKEN }])) === true;
    } catch {
      return false;
    }
  },
};
