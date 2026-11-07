import { module } from "@keel/compiler";

export default module({
  id: "kitchen",
  deps: ["recipes"],
  capabilities: ["random", "storage"],
  public: { exports: [], routes: [] },
});
