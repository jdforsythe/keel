import { module } from "@keel/compiler";

export default module({
  id: "accounts",
  deps: ["@keel/std-brands", "@keel/std-tokens", "@keel/std-messages"],
  capabilities: ["clock", "random", "storage"],
  public: {
    exports: ["MintedToken", "Me", "TokenRequest"],
  },
});
