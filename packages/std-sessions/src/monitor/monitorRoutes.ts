import { manifest } from "@keel/router";
import { reader } from "../routes/reader.guard.ts";
import { loadTally } from "./loadTally.ts";

/**
 * The tally route (std.monitor), for a `node` deployable (E2009): API route `sessions.tally` (`GET /sessions/tally`)
 * behind guard `sessions.reader` (a caller in `readers`, else 403 `keel.denied`) returns the stored `Tally`. A
 * deployable unions `monitorRoutes.routes`.
 */
export const monitorRoutes = manifest({
  "sessions.tally": { api: true, path: "/sessions/tally", guard: reader, loader: loadTally },
});
