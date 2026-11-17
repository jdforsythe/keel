import { module } from "@keel/compiler";

export default module({
  id: "accounts",
  deps: ["@keel/std-credentials"],
  capabilities: ["clock", "random", "storage"],
  public: {
    exports: ["MintedToken", "Me", "TokenRequest"],
    routes: ["accounts.tokens", "accounts.me"],
  },
});
