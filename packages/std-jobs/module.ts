import { module } from "@keel/compiler";

/** The `@keel/std-jobs` stdlib module manifest (std.jobs, k.module): a module that defines jobs lists the package in `deps`. */
export default module({
  id: "jobs",
  deps: [],
  capabilities: ["clock", "random", "storage"],
  public: { exports: ["job", "queue"], routes: [] },
});
