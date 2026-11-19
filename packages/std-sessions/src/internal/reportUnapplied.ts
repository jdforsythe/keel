import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";

/**
 * Report on a replay's `ctx` that recorded input `index` cannot apply (std.sessions E2003), as an `error` its
 * recorder records: the replay's fingerprint is then this error's, so it differs from a session that recorded no error
 * before that input, and `reproduced` is false.
 */
export function reportUnapplied(ctx: Ctx, index: number): void {
  report(ctx, {
    kind: "error",
    error: { code: "E2003", message: `cannot apply input ${index}`, data: { at: "sessions.replay" } },
  });
}
