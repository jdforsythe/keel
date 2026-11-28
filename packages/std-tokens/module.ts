import { module } from "@keel/compiler";

/** The `@keel/std-tokens` library manifest (std.tokens, k.library): a module that mints or verifies opaque tokens lists the package in `deps`. */
export default module({
  id: "tokens",
  deps: [],
  capabilities: ["clock"],
  public: {
    exports: ["Digested"],
  },
});
