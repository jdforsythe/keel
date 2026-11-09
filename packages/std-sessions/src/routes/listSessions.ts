import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { archiveStores } from "../archiveStores.ts";
import { ListSearch } from "./ListSearch.schema.ts";
import { Listing } from "./Listing.schema.ts";

/**
 * `GET /sessions/list` (`sessions.list`, std.sessions Ingest; behind guard `sessions.reader`): the archive's sessions
 * by fingerprint (`Listing`: byte counts stay on the server), keeping with `failing` only sessions with
 * an error (and fingerprints left with one), with `since` only `last >= since`.
 */
export const listSessions = loader(
  { output: Listing, search: ListSearch, stores: archiveStores },
  async ({ search, stores }) => {
    const out: Listing = {};
    for (const [fp, e] of Object.entries(stores.archive.snapshot().state)) {
      if (search.since !== undefined && e.last < search.since) continue;
      const kept = e.sessions.map((x) => x.session);
      const sessions = search.failing === true ? kept.filter((x) => x.error !== null) : kept;
      if (sessions.length > 0) out[fp] = { count: e.count, first: e.first, last: e.last, sessions };
    }
    return ok(out);
  },
);
