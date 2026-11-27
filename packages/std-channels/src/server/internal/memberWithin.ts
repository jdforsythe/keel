import { type Ctx, supervise } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { Rejected } from "../../internal/Rejected.schema.ts";

/** How long a stream waits on `ctx.clock` for the re-read of its stores and `member` after a save (std.channels). */
const MEMBER_MS = 5_000;

/**
 * Whether `answer`, a stream's re-read of its stores and `member` after a save, is `true` within 5,000 ms on
 * `ctx.clock`. Supervised as `channels.member` (k.supervise): a throw of any value is reported once and, as an
 * answer not settled in time, is a denial, so one stream's chain of checks never stalls.
 */
export async function memberWithin(ctx: Ctx, answer: Promise<boolean>): Promise<boolean> {
  const timer = new AbortController();
  const late = attempt(
    () => ctx.clock.after(MEMBER_MS, timer.signal),
    (x) => (x === timer.signal.reason ? Rejected.make({}) : undefined),
  ).then(() => false);
  const asked = supervise(ctx, "channels.member", () => answer, Rejected.make({})).then((r) => r.ok && r.value);
  const isMember = await Promise.race([asked, late]);
  timer.abort();
  return isMember;
}
