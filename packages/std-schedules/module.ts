import { module } from "@keel/compiler";

/** The `@keel/std-schedules` stdlib module manifest (std.schedules, k.module): a module that schedules lists it in `deps`. */
export default module({
  id: "schedules",
  deps: ["@keel/std-jobs", "@keel/std-temporal"],
  capabilities: ["clock", "storage"],
  public: { exports: ["schedule"] },
});
