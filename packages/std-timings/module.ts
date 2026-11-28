import { module } from "@keel/compiler";

/** The `@keel/std-timings` library manifest (std.timings, k.library): a module that times its work for the inspector lists the package in `deps`. */
export default module({
  id: "timings",
  deps: [],
  capabilities: ["clock"],
  public: {
    exports: ["time", "Timings", "TimingsRecent", "timingsOf"],
  },
});
