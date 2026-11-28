import { module } from "@keel/compiler";

/** The `@keel/std-text` library manifest (std.text, k.library): a module that holds, checks or measures text lists the package in `deps`. */
export default module({
  id: "text",
  deps: ["@keel/std-i18n"],
  capabilities: [],
  public: {
    exports: ["compareText", "Email", "graphemes", "line", "para", "Slug", "truncate"],
  },
});
