import { manifest } from "@keel/router";
import { ListSearch } from "./routes/ListSearch.schema.ts";
import { ingestSession } from "./routes/ingestSession.server.ts";
import { listSessions } from "./routes/listSessions.server.ts";
import { reader } from "./routes/reader.guard.ts";

/**
 * The `@keel/std-sessions` ingest routes (std.sessions Ingest), for a `node` deployable (E2005): `sessions.ingest`
 * (`POST /sessions`, a `Session`) adds to store `sessions.archive`; `sessions.list` (`GET /sessions/list`, search
 * `{ failing?, since? }`) reads it behind guard `sessions.reader`. A deployable unions `routes.routes`.
 */
export const routes = manifest({
  "sessions.ingest": { api: true, path: "/sessions" },
  "sessions.list": {
    api: true,
    path: "/sessions/list",
    search: ListSearch,
    guard: reader,
    loader: listSessions,
  },
});
routes.actions({ "sessions.ingest": { POST: ingestSession } });
