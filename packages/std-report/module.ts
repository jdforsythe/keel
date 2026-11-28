import { module } from "@keel/compiler";

/** The `@keel/std-report` library manifest (std.report, k.library): a module that tallies its report lists the package in `deps`. */
export default module({
  id: "report",
  deps: [],
  capabilities: [],
  public: {
    exports: ["Tally", "tallyOf"],
  },
});
