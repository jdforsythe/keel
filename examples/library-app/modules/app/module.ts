import { module } from "@keel/compiler";

export default module({
  id: "app",
  deps: ["@example/library-charts", "@example/library-looks"],
  capabilities: [],
  public: { exports: [] },
});
