import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: ["todos"],
  capabilities: ["random"],
  public: { exports: [], routes: ["api.lists"] },
});
