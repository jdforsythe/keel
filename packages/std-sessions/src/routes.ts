import { manifest } from "@keel/router";
import { ingestSession } from "./routes/ingestSession.server.ts";
import { listSessions } from "./routes/listSessions.server.ts";
import { loadTally } from "./routes/loadTally.server.ts";
import { reader } from "./routes/reader.guard.ts";
import { sessions } from "./sessions.contract.ts";

/**
 * The `@keel/std-sessions` routes (std.sessions Ingest, std.monitor Read, std.contracts), for a `node` deployable
 * (E2005): the binding of `sessions`. `sessions.ingest` adds to store `sessions.archive`; `sessions.list` reads it and
 * `sessions.tally` the `monitor` runner's tally, both behind guard `sessions.reader`. Placing module `sessions` puts
 * it in the deployable's `routeTable`, with or without `monitor` in the runners.
 */
export const routes = manifest(sessions, {
  "sessions.ingest": { action: ingestSession },
  "sessions.list": { loader: listSessions, guard: reader },
  "sessions.tally": { loader: loadTally, guard: reader },
});
