import { module } from "@keel/compiler";

export default module({
  id: "app",
  deps: ["shopping", "receipts"],
  capabilities: [],
  public: { exports: [] },
});
