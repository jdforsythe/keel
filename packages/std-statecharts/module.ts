import { module } from "@keel/compiler";

/** The `@keel/std-statecharts` library manifest (std.statecharts, k.library): charts, their instances and coverage over a store. */
export default module({
  id: "statecharts",
  deps: [],
  capabilities: [],
  public: {
    exports: ["Chart", "chart", "ChartInstance", "ChartSpec", "ChartState", "Coverage", "coverage", "instance", "StateSpec", "Target"],
  },
});
