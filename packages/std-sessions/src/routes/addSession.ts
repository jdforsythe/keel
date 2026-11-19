import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Archive } from "../Archive.schema.ts";
import { Session } from "../Session.schema.ts";
import { utf8Length } from "../internal/utf8Length.ts";
import { ARCHIVE_BOUNDS } from "./ARCHIVE_BOUNDS.ts";
import { archiveBytes } from "./archiveBytes.ts";
import { entryBytes } from "./entryBytes.ts";
import { itemBytes } from "./itemBytes.ts";

/** The fingerprint with the oldest `last` other than `keep` (ties: the smaller key), or undefined. */
function oldest(archive: Archive, keep: string): string | undefined {
  let out: string | undefined;
  let last = Number.POSITIVE_INFINITY;
  for (const [k, e] of Object.entries(archive)) {
    if (k === keep || e.last > last || (e.last === last && out !== undefined && k > out)) continue;
    out = k;
    last = e.last;
  }
  return out;
}

/**
 * `sessions.addSession` on `archive` (std.sessions Ingest): file `session` under its fingerprint at ingest time `at`
 * (`count` + 1, `first` kept, `last` = `at`, the newest 5 sessions in arrival order, each with its encoded JSON
 * `bytes`), then evict the fingerprint with the oldest `last` while there are more than 64 or the archive is over
 * 4 MiB (`ARCHIVE_BOUNDS`); the one this write filed never goes. Sizes come from each kept session's `bytes`, so a
 * write is linear in the number of sessions and never re-encodes the archive.
 */
export const addSession = (archive: Store<Archive>) =>
  transaction(archive, "sessions.addSession", s.object({ at: s.number(), session: Session }), (state, p) => {
    const fp = p.session.fingerprint;
    const bytes = utf8Length(JSON.stringify(Session.encode(p.session)));
    const prev = Object.hasOwn(state, fp) ? state[fp] : undefined;
    const sessions = [...(prev?.sessions ?? []), { bytes, session: p.session }].slice(-ARCHIVE_BOUNDS.perFingerprint);
    const next: Archive = {
      ...state,
      [fp]: { count: (prev?.count ?? 0) + 1, first: prev?.first ?? p.at, last: p.at, sessions },
    };
    let total = archiveBytes(next);
    let count = Object.keys(next).length;
    while (count > ARCHIVE_BOUNDS.fingerprints || total > ARCHIVE_BOUNDS.bytes) {
      const gone = oldest(next, fp);
      const e = gone === undefined ? undefined : next[gone];
      if (gone === undefined || e === undefined) break;
      total -= entryBytes(gone) + e.sessions.reduce((n, x) => n + itemBytes(x), 0);
      count--;
      delete next[gone];
    }
    return next;
  });
