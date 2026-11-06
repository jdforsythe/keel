import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: ["todos"],
  capabilities: [],
  public: { exports: [], routes: [] },
});
