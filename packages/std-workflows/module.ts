import { module } from "@keel/compiler";

/**
 * The `@keel/std-workflows` stdlib module manifest (std.workflows, k.module): a module with workflows lists it,
 * `@keel/std-jobs` and `@keel/std-statecharts` in `deps`.
 */
export default module({
  id: "workflows",
  deps: [],
  capabilities: ["clock", "random", "storage"],
  public: { exports: ["workflow", "flows"] },
});
