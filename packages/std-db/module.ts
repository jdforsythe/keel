import { module } from "@keel/compiler";

/**
 * The `@keel/std-db` module manifest (std.db, k.module): the storage drivers a `node` deployable's generated entry
 * opens for `storage: 'sqlite'` or `'postgres'`. App code never imports the package (E2151).
 */
export default module({
  id: "db",
  deps: [],
  capabilities: [],
  public: { exports: [] },
});
