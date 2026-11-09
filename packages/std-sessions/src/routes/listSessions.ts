import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Archive } from "../Archive.schema.ts";
import { archiveStores } from "../archiveStores.ts";
import { ListSearch } from "./ListSearch.schema.ts";

/**
 * `GET /sessions/list` (`sessions.list`, std.sessions Ingest; behind guard `sessions.reader`): the archive, keeping
 * with `failing` only sessions with an error (and fingerprints left with one), with `since` only `last >= since`.
 */
export const listSessions = loader(
  { output: Archive, search: ListSearch, stores: archiveStores },
  async ({ search, stores }) => {
    const out: Archive = {};
    for (const [fp, e] of Object.entries(stores.archive.snapshot().state)) {
      if (search.since !== undefined && e.last < search.since) continue;
      const sessions = search.failing === true ? e.sessions.filter((x) => x.error !== null) : e.sessions;
      if (sessions.length > 0) out[fp] = { ...e, sessions };
    }
    return ok(out);
  },
);
