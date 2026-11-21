import { module } from "@keel/compiler";

export default module({
  id: "app",
  deps: ["members", "receipts", "setup", "shopping"],
  capabilities: [],
  public: { exports: [] },
});
