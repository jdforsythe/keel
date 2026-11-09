import { module } from "@keel/compiler";

/**
 * The ingest service's own module: it serves `@keel/std-sessions/routes` and a home page. `readers` holds the caller
 * hashes `sessions.list` admits; the sample is the hash of the token `sample-reader-token` (README: add your own).
 */
export default module({
  id: "ops",
  deps: ["@keel/std-sessions"],
  capabilities: ["observe", "session"],
  public: { exports: [], routes: [] },
  std: { "@keel/std-sessions": { readers: ["2ZU4DEJJ8qr3iNQ4IFXrALxGi7WEkg6gV3aV_mjv5zc"] } },
});
