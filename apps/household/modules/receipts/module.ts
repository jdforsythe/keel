import { module } from "@keel/compiler";

export default module({
  id: "receipts",
  deps: ["setup", "@keel/std-i18n", "@keel/std-messages", "@keel/std-money", "@keel/std-text"],
  capabilities: ["random"],
  public: { exports: [] },
});
