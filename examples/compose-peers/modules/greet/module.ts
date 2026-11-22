import { module } from "@keel/compiler";

export default module({
  id: "greet",
  deps: [],
  capabilities: [],
  public: { exports: ["Greeting"] },
});
