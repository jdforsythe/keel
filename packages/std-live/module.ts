import { module } from "@keel/compiler";

/** The `@keel/std-live` library manifest (std.live, k.library): a module that keeps a store current lists the package in `deps`. */
export default module({
  id: "live",
  deps: ["@keel/std-channels"],
  capabilities: ["clock"],
  public: { exports: ["live", "LiveStatus"] },
});
