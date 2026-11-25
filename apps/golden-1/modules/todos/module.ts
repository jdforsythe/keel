import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: ["api", "@keel/std-live", "@keel/std-offline", "@keel/std-statecharts"],
  capabilities: ["net", "storage"],
  public: { exports: [] },
});
