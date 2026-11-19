import type { Session } from "../Session.schema.ts";
import { fingerprint } from "./fingerprint.ts";

/**
 * The fingerprint of `session` from what it holds (std.sessions): its first `error` event's code, recorded `data.at`
 * and route id; with no error event, the base route id. The recorder, `replay`, `minimize` and `sessions.ingest` all
 * compute it this way, so a posted value is never trusted.
 */
export function sessionFingerprint(session: Pick<Session, "events" | "route">): string {
  const first = session.events.find((e) => e.kind === "error");
  return first?.kind === "error" ? fingerprint(first.error, first.route) : fingerprint(null, session.route.id);
}
