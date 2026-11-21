import { module } from "@keel/compiler";

export default module({
  id: "setup",
  deps: ["@keel/std-text"],
  capabilities: [],
  public: { exports: ["setUp"] },
});
