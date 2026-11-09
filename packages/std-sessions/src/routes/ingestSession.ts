import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Session } from "../Session.schema.ts";
import { archiveStores } from "../archiveStores.ts";
import { utf8Length } from "../internal/utf8Length.ts";
import { MAX_INGEST_BYTES } from "./MAX_INGEST_BYTES.ts";
import { ingestFingerprint } from "./ingestFingerprint.ts";

/**
 * `POST /sessions` (`sessions.ingest`, std.sessions Ingest): a `Session` (invalid: 422 `keel.fields`), at most 256
 * KiB of encoded JSON (over: 413 `keel.payloadTooLarge`, on top of the server's `maxBodyBytes`), re-fingerprinted
 * and added to store `sessions.archive` at the ingest clock's `now()`.
 */
export const ingestSession = action({ input: Session, stores: archiveStores }, (session, { stores }, ctx) => {
  const limit = MAX_INGEST_BYTES;
  if (utf8Length(JSON.stringify(Session.encode(session))) > limit)
    return err({ code: "keel.payloadTooLarge", message: `session exceeds ${limit} bytes`, data: { limit } });
  const r = tx(stores.addSession, {
    at: ctx.clock.now(),
    session: { ...session, fingerprint: ingestFingerprint(session) },
  });
  return r.ok ? ok(null) : err(r.error);
});
