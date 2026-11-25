import { module } from "@keel/compiler";

export default module({
  id: "charts",
  deps: [],
  capabilities: [],
  public: { exports: ["BarChart", "LineChart", "Sparkline", "Point", "ChartText", "ChartStyles"] },
});
