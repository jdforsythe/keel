import { module } from "@keel/compiler";

export default module({
  id: "shopping",
  deps: [
    "members",
    "@keel/std-channels",
    "@keel/std-jobs",
    "@keel/std-live",
    "@keel/std-postgres",
    "@keel/std-schedules",
    "@keel/std-statecharts",
    "@keel/std-temporal",
    "@keel/std-workflows",
  ],
  capabilities: ["clock", "random", "storage", "shopping.db"],
  public: { exports: ["RestockPanel", "RestockText", "restockText", "Runs", "shoppingApi"] },
});
