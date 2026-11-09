import type { Session } from "../Session.schema.ts";
import { fingerprint } from "../internal/fingerprint.ts";

const HEX12 = /^[0-9a-f]{12}$/;

/**
 * The fingerprint `sessions.ingest` files `session` under (std.sessions Ingest): recomputed from its `error` and the
 * error's route, so a client cannot file one bug under another's fingerprint. The session holds that route only
 * when no `nav` precedes the first `error` event (it is then the base route), and the hashed `data.at` only when
 * redaction left it (an `error:` entry masks it as `x` repeated). Otherwise the posted value is kept when it is 12
 * hex characters (`keel session replay` checks it, E2004), else recomputed from what the session holds.
 */
export function ingestFingerprint(session: Session): string {
  const first = session.events.findIndex((e) => e.kind === "error");
  const navFirst = session.events.some((e, i) => e.kind === "nav" && (first < 0 || i < first));
  const data = session.error?.data;
  const at = typeof data === "object" && data !== null && !Array.isArray(data) ? data.at : undefined;
  const masked = typeof at === "string" && /^x+$/.test(at);
  const own = fingerprint(session.error, session.route.id);
  return (navFirst || masked) && HEX12.test(session.fingerprint) ? session.fingerprint : own;
}
