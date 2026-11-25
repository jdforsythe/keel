import { module } from "@keel/compiler";

/**
 * The `@keel/std-postgres` module manifest (std.postgres, k.module): apps list the package in `deps`. `env` names the
 * variable its server code reads, which `deploy/compose.yaml` passes to each deployable serving a module that lists it
 * (k.server-deps Environment).
 */
export default module({
  id: "postgres",
  deps: [],
  capabilities: [],
  public: { exports: ["database", "fragment", "NoRows", "sql"] },
  env: ["KEEL_POSTGRES_URL"],
});
