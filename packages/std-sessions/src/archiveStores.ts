import { invariant, store } from "@keel/store";
import { Archive } from "./Archive.schema.ts";
import { ARCHIVE_BOUNDS } from "./routes/ARCHIVE_BOUNDS.ts";
import { addSession } from "./routes/addSession.ts";
import { archiveBytes } from "./routes/archiveBytes.ts";

/**
 * The ingest service's server state (k.server Server state): store `sessions.archive`, restored from and saved to
 * `ctx.storage` per request, with `addSession` bound to it. It keeps no log (`logLimit: 0`): a session is up to
 * 256 KiB and nothing undoes an ingest. Invariant `sessions.capped`: at most 64 fingerprints, 1 to 5 sessions each,
 * `count` at least the sessions kept, and the archive JSON within 4 MiB (by the tracked `bytes`, never re-encoding
 * the archive).
 */
export function archiveStores() {
  const archive = store(Archive, {}, { id: "sessions.archive", logLimit: 0 });
  invariant(archive, (state) => {
    const entries = Object.values(state);
    return (
      entries.length <= ARCHIVE_BOUNDS.fingerprints &&
      entries.every(
        (e) =>
          e.sessions.length >= 1 && e.sessions.length <= ARCHIVE_BOUNDS.perFingerprint && e.count >= e.sessions.length,
      ) &&
      archiveBytes(state) <= ARCHIVE_BOUNDS.bytes
    );
  });
  return { archive, addSession: addSession(archive) };
}
