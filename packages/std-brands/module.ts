import { module } from "@keel/compiler";

/** The `@keel/std-brands` library manifest (std.brands, k.library): a module that lists the package in `deps` has `keel check` run its rule E2101, one PascalCase spelling per id brand. */
export default module({
  id: "brands",
  deps: [],
  capabilities: [],
  public: {
    exports: [],
  },
});
