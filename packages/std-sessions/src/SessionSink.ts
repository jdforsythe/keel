import type { Id, KeelError, Result } from "@keel/schema";
import type { Session } from "./Session.schema.ts";

/** The `session` capability (std.sessions): real POSTs, shell drops, sim keeps every put in `taken()`. */
export interface SessionSink {
  /** real: POST JSON (`keepalive` up to 64 KiB), ok on 2xx, else err (network failure: status 0); shell: ok(null), no request; sim: ok(null), kept. */
  put(url: URL, session: Session): Promise<Result<null, KeelError<"sessions.putFailed", { status: number }>>>;
  /** sim: every put on this ctx, oldest first; real and shell: []. */
  taken(): readonly { readonly url: URL; readonly session: Session }[];
  /** A fresh `random.id("Session")` from the capability's own ctx (sim: seeded by its derived seed). */
  id(): Id<"Session">;
}
