import { module } from "@keel/compiler";

/** The `@keel/std-sessions` stdlib module manifest (std.sessions, k.module): apps list the package in `deps`. */
export default module({
  id: "sessions",
  deps: [],
  capabilities: ["clock", "session", "storage"],
  public: {
    exports: ["record", "replay", "minimize", "session", "Session", "routes"],
    routes: ["sessions.ingest", "sessions.list"],
  },
});
