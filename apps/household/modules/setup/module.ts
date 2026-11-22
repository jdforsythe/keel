import { module } from "@keel/compiler";

export default module({
  id: "setup",
  deps: ["members", "shopping", "@keel/std-text"],
  capabilities: [],
  public: { exports: ["householdStores"] },
});
