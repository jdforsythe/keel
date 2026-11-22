import { module } from "@keel/compiler";

export default module({
  id: "accounts",
  deps: ["@keel/std-brands", "@keel/std-messages", "@keel/std-postgres", "@keel/std-sessions", "@keel/std-tokens"],
  capabilities: ["clock", "random", "storage", "accounts.db"],
  public: {
    exports: ["MintedToken", "Me", "TokenRequest"],
  },
  // The user id of the operator account that reads `sessions.list` and `sessions.tally`.
  std: { "@keel/std-sessions": { readers: ["golden-2-ops"] } },
});
