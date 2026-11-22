import { module } from "@keel/compiler";

export default module({
  id: "shopping",
  deps: ["members", "receipts", "setup", "@keel/std-channels", "@keel/std-live", "@keel/std-postgres"],
  capabilities: ["random", "shopping.db"],
  public: { exports: [] },
});
