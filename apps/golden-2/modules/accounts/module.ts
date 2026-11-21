import { module } from "@keel/compiler";

export default module({
  id: "accounts",
  deps: ["@keel/std-brands", "@keel/std-messages", "@keel/std-postgres", "@keel/std-tokens"],
  capabilities: ["clock", "random", "storage", "accounts.db"],
  public: {
    exports: ["MintedToken", "Me", "TokenRequest"],
  },
});
