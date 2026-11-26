import { module } from "@keel/compiler";

export default module({
  id: "acme",
  deps: [],
  capabilities: [],
  public: { exports: ["Card", "Badge", "Switch", "Toggle"] },
});
