import { module } from "@keel/compiler";

export default module({
  id: "shopping",
  deps: ["setup"],
  capabilities: ["random"],
  public: { exports: [] },
});
