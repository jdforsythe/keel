import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: [],
  capabilities: ["net", "random", "storage"],
  public: { exports: [], routes: [] },
});
