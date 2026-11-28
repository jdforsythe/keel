import { module } from "@keel/compiler";

/** The `@keel/std-messages` library manifest (std.messages, k.library): a module that declares or formats a message set lists the package in `deps`. */
export default module({
  id: "messages",
  deps: ["@keel/std-i18n"],
  capabilities: [],
  public: {
    exports: ["formatMessage", "Message", "MessageSet", "messages"],
  },
});
