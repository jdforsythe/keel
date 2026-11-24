import type { Ctx } from "@keel/ctx";
import { actives } from "./actives.ts";

/**
 * Note on a replay's `ctx` recorder that recorded input `index` cannot apply (std.sessions E2003), as an `error` it
 * records: the replay's fingerprint is then this error's, so it differs from a session that recorded no error
 * before that input, and `reproduced` is false. `index` -1 is the base (a redirect carries its own `message`).
 */
export function reportUnapplied(ctx: Ctx, index: number, message = `cannot apply input ${index}`): void {
  actives.get(ctx)?.note({
    kind: "error",
    error: { code: "E2003", message, data: { at: "sessions.replay" } },
  });
}
