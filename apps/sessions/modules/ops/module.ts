import { module } from "@keel/compiler";

/**
 * The ingest service's own module: it serves `@keel/std-sessions/routes` and a home page. `readers` holds the caller
 * hashes `sessions.list` admits: the entry is the hash of the deployed service's reader cookie (README: Readers).
 */
export default module({
  id: "ops",
  deps: ["@keel/std-sessions"],
  capabilities: ["observe", "session"],
  public: { exports: [], routes: [] },
  std: { "@keel/std-sessions": { readers: ["HQ3-vDAEJk08Fmm0vNVarVrk57DUiJeosEqTEb3BG5E"] } },
});
