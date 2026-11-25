import { module } from "@keel/compiler";

export default module({
  id: "trip",
  deps: ["@keel/std-brands", "@keel/std-headless", "@keel/std-i18n"],
  capabilities: ["clock", "random"],
  public: { exports: [] },
});
