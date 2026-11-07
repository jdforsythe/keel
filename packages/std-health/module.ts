import { module } from "@keel/compiler";

/** The `@keel/std-health` stdlib module manifest (std.health, k.module): apps list the package in `deps`. */
export default module({
  id: "health",
  deps: [],
  capabilities: ["clock"],
  public: { exports: ["Health", "routes"], routes: ["health.status"] },
});
