import { module } from "@keel/compiler";

export default module({
  id: "kitchen",
  deps: ["recipes", "@keel/std-money", "@keel/std-temporal", "@keel/std-text"],
  capabilities: ["clock", "random", "storage"],
  public: { exports: [], routes: [] },
});
