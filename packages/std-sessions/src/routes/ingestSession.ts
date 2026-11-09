import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Session } from "../Session.schema.ts";
import { archiveStores } from "../archiveStores.ts";
import { sessionFingerprint } from "../internal/sessionFingerprint.ts";
import { utf8Length } from "../internal/utf8Length.ts";
import { MAX_INGEST_BYTES } from "./MAX_INGEST_BYTES.ts";

/**
 * `POST /sessions` (`sessions.ingest`, std.sessions Ingest): a `Session` (invalid: 422 `keel.fields`) whose `error`
 * and `fingerprint` are recomputed from its events (the first `error` event), so a posted value never chooses where
 * it is filed, then added to store `sessions.archive` at the ingest clock's `now()`. The session as filed is at most
 * 256 KiB of encoded JSON (over: 413 `keel.payloadTooLarge`, on top of the server's `maxBodyBytes`).
 */
export const ingestSession = action({ input: Session, stores: archiveStores }, (posted, { stores }, ctx) => {
  const first = posted.events.find((e) => e.kind === "error");
  const error = first?.kind === "error" ? first.error : null;
  const session: Session = { ...posted, error, fingerprint: sessionFingerprint(posted) };
  const limit = MAX_INGEST_BYTES;
  if (utf8Length(JSON.stringify(Session.encode(session))) > limit)
    return err({ code: "keel.payloadTooLarge", message: `session exceeds ${limit} bytes`, data: { limit } });
  const r = tx(stores.addSession, { at: ctx.clock.now(), session });
  return r.ok ? ok(null) : err(r.error);
});
