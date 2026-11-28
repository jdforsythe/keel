import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { Rejected } from "../../internal/Rejected.schema.ts";

/** How long a save's shared read of a stored snapshot may take on `ctx.clock` (std.channels). */
const READ_MS = 5_000;

/**
 * `read`, a read of a stored snapshot the process's streams share for one save, or `undefined` when it has not settled
 * within 5,000 ms on `ctx.clock`: one timer per read, cancelled when it settles. A rejection passes on as it is.
 */
export async function withinRead(ctx: Ctx, read: Promise<string | null>): Promise<string | null | undefined> {
  const timer = new AbortController();
  const late = attempt(
    () => ctx.clock.after(READ_MS, timer.signal),
    (x) => (x === timer.signal.reason ? Rejected.make({}) : undefined),
  ).then(() => undefined);
  try {
    return await Promise.race([read, late]);
  } finally {
    timer.abort();
  }
}
