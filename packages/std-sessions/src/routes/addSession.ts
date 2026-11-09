import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Archive } from "../Archive.schema.ts";
import { Session } from "../Session.schema.ts";
import { utf8Length } from "../internal/utf8Length.ts";
import { ARCHIVE_BOUNDS } from "./ARCHIVE_BOUNDS.ts";
import { archiveBytes } from "./archiveBytes.ts";
import { entryBytes } from "./entryBytes.ts";
import { itemBytes } from "./itemBytes.ts";

type Item = Archive[string]["sessions"][number];
type Holding = { bytes: number; sessions: number };
type Found = { readonly fp: string; readonly item: Item; readonly last: number };

/** The session to drop from a fingerprint past 5: the oldest of the caller with the most there (ties: older first). */
function crowded(sessions: readonly Item[]): Item | undefined {
  const n = new Map<string, number>();
  for (const x of sessions) n.set(x.caller, (n.get(x.caller) ?? 0) + 1);
  let out: Item | undefined;
  for (const x of sessions) if (out === undefined || (n.get(x.caller) ?? 0) > (n.get(out.caller) ?? 0)) out = x;
  return out;
}

/** The oldest session of `caller` that `allowed` admits: by its fingerprint's `last`, then key, then arrival. */
function oldestOf(archive: Archive, caller: string, allowed: (fp: string, x: Item) => boolean): Found | undefined {
  let out: Found | undefined;
  for (const [fp, e] of Object.entries(archive)) {
    if (out !== undefined && (e.last > out.last || (e.last === out.last && fp > out.fp))) continue;
    const item = e.sessions.find((x) => x.caller === caller && allowed(fp, x));
    if (item !== undefined) out = { fp, item, last: e.last };
  }
  return out;
}

/** Callers by archive share: most bytes first, then fewest sessions, then key. */
const byShare = ([a, x]: [string, Holding], [b, y]: [string, Holding]): number =>
  y.bytes - x.bytes || x.sessions - y.sessions || (a < b ? -1 : a > b ? 1 : 0);

/**
 * `sessions.addSession` on `archive` (std.sessions Ingest): file `session` from `caller` under its fingerprint at
 * ingest time `at` (`count` + 1, `first` kept, `last` = `at`, sessions in arrival order). Past 5 there, the oldest
 * session of the caller holding the most of them goes. Past the caller quota (1 MiB, 16 fingerprints) the writer's own
 * oldest sessions go. Past 64 fingerprints or 4 MiB, the oldest session of the caller holding the largest share
 * (bytes, then fewest sessions, then key) goes, never one of the fingerprint this write filed into unless that caller
 * is the writer, and never the new session. Sizes come from each session's `bytes`, so a write is linear in sessions.
 */
export const addSession = (archive: Store<Archive>) =>
  transaction(
    archive,
    "sessions.addSession",
    s.object({ at: s.number(), caller: s.string(), session: Session }),
    (state, p) => {
      const fp = p.session.fingerprint;
      const bytes = utf8Length(JSON.stringify(Session.encode(p.session)));
      const filed: Item = { caller: p.caller, bytes, session: p.session };
      const prev = Object.hasOwn(state, fp) ? state[fp] : undefined;
      const sessions = [...(prev?.sessions ?? []), filed];
      while (sessions.length > ARCHIVE_BOUNDS.perFingerprint)
        sessions.splice(sessions.indexOf(crowded(sessions) ?? filed), 1);
      const entry = { count: (prev?.count ?? 0) + 1, first: prev?.first ?? p.at, last: p.at, sessions };
      const next: Archive = { ...state, [fp]: entry };

      const held = new Map<string, Holding>();
      for (const e of Object.values(next))
        for (const x of e.sessions) {
          const h = held.get(x.caller) ?? { bytes: 0, sessions: 0 };
          held.set(x.caller, { bytes: h.bytes + x.bytes, sessions: h.sessions + 1 });
        }
      let total = archiveBytes(next);
      const drop = (found: Found): void => {
        const e = next[found.fp];
        if (e === undefined) return;
        const rest = e.sessions.filter((x) => x !== found.item);
        total -= itemBytes(found.item);
        if (rest.length > 0) next[found.fp] = { ...e, sessions: rest };
        else {
          delete next[found.fp];
          total -= entryBytes(found.fp);
        }
        const h = held.get(found.item.caller) ?? { bytes: 0, sessions: 0 };
        held.set(found.item.caller, { bytes: h.bytes - found.item.bytes, sessions: h.sessions - 1 });
      };
      const spread = (caller: string): number =>
        Object.values(next).filter((e) => e.sessions.some((x) => x.caller === caller)).length;

      for (;;) {
        const h = held.get(p.caller);
        const over =
          h !== undefined &&
          (h.bytes > ARCHIVE_BOUNDS.callerBytes || spread(p.caller) > ARCHIVE_BOUNDS.callerFingerprints);
        const found = over ? oldestOf(next, p.caller, (_, x) => x !== filed) : undefined;
        if (found === undefined) break;
        drop(found);
      }
      while (Object.keys(next).length > ARCHIVE_BOUNDS.fingerprints || total > ARCHIVE_BOUNDS.bytes) {
        let found: Found | undefined;
        for (const [caller, h] of [...held.entries()].sort(byShare)) {
          if (h.sessions === 0) continue;
          found = oldestOf(next, caller, (k, x) => x !== filed && (caller === p.caller || k !== fp));
          if (found !== undefined) break;
        }
        if (found === undefined) break;
        drop(found);
      }
      return next;
    },
  );
