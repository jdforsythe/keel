import { module } from "@keel/compiler";

export default module({
  id: "shopping",
  deps: [
    "members",
    "@keel/std-channels",
    "@keel/std-jobs",
    "@keel/std-live",
    "@keel/std-offline",
    "@keel/std-postgres",
    "@keel/std-schedules",
    "@keel/std-statecharts",
    "@keel/std-temporal",
    "@keel/std-text",
    "@keel/std-workflows",
  ],
  capabilities: ["clock", "random", "storage", "shopping.db"],
  public: { exports: ["RestockPanel", "restockStores", "RestockText", "restockText", "Runs", "runsOf", "shoppingApi"] },
});
