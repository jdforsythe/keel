import { module } from "@keel/compiler";

export default module({
  id: "receipts",
  deps: ["members", "@keel/std-i18n", "@keel/std-messages", "@keel/std-money", "@keel/std-postgres", "@keel/std-text"],
  capabilities: ["random", "receipts.db"],
  public: { exports: [] },
});
