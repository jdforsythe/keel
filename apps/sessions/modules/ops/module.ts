import { module } from "@keel/compiler";

/**
 * The ingest service's own module: the home page, beside the `sessions` module `topology.ts` places. `readers`
 * holds the caller hashes `sessions.list` admits: the entry is the hash of the deployed service's reader cookie
 * (README: Readers).
 */
export default module({
  id: "ops",
  deps: ["@keel/std-sessions"],
  capabilities: ["observe", "session"],
  public: { exports: [], routes: [] },
  std: { "@keel/std-sessions": { readers: ["h1NjuCrFnI-AX_1RSVPsvEjwe6-Em7G-6PDzHAqbRfA"] } },
});
