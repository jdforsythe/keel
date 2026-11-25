import { module } from "@keel/compiler";

export default module({
  id: "shifts",
  deps: ["@keel/std-sessions", "@keel/std-text"],
  capabilities: ["observe", "random", "session", "storage"],
  public: { exports: [] },
  clientPii: ["name", "contact", "special", "identifier"],
  std: { "@keel/std-sessions": { readers: [] } },
});
