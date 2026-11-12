import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: ["api"],
  capabilities: ["net", "storage"],
  public: { exports: [], routes: [] },
});
