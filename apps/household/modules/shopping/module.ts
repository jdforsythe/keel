import { module } from "@keel/compiler";

export default module({
  id: "shopping",
  deps: ["members", "@keel/std-postgres"],
  capabilities: ["random", "shopping.db"],
  public: { exports: [] },
});
