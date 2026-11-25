import { module } from "@keel/compiler";

export default module({
  id: "trip",
  deps: ["@keel/std-brands", "@keel/std-headless"],
  capabilities: ["clock", "random"],
  public: { exports: [] },
});
