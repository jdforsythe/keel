import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Archive } from "../Archive.schema.ts";
import { Session } from "../Session.schema.ts";
import { ARCHIVE_BOUNDS } from "./ARCHIVE_BOUNDS.ts";
import { archiveBytes } from "./archiveBytes.ts";

/** The fingerprint with the oldest `last` other than `keep` (ties: the smaller key), or undefined. */
function oldest(archive: Archive, keep: string): string | undefined {
  let out: string | undefined;
  for (const k of Object.keys(archive).sort()) {
    const e = archive[k];
    const o = out === undefined ? undefined : archive[out];
    if (k !== keep && e !== undefined && (o === undefined || e.last < o.last)) out = k;
  }
  return out;
}

/**
 * `sessions.addSession` on `archive` (std.sessions Ingest): file `session` under its fingerprint at ingest time `at`
 * (`count` + 1, `first` kept, `last` = `at`, the newest 5 sessions in arrival order), then evict the fingerprint with
 * the oldest `last` while there are more than 64 or the archive JSON is over 4 MiB (`ARCHIVE_BOUNDS`).
 */
export const addSession = (archive: Store<Archive>) =>
  transaction(archive, "sessions.addSession", s.object({ at: s.number(), session: Session }), (state, p) => {
    const fp = p.session.fingerprint;
    const prev = Object.hasOwn(state, fp) ? state[fp] : undefined;
    const next: Archive = { ...state };
    next[fp] = {
      count: (prev?.count ?? 0) + 1,
      first: prev?.first ?? p.at,
      last: p.at,
      sessions: [...(prev?.sessions ?? []), p.session].slice(-ARCHIVE_BOUNDS.perFingerprint),
    };
    for (;;) {
      const over = Object.keys(next).length > ARCHIVE_BOUNDS.fingerprints || archiveBytes(next) > ARCHIVE_BOUNDS.bytes;
      const gone = over ? oldest(next, fp) : undefined;
      if (gone === undefined) return next;
      delete next[gone];
    }
  });
