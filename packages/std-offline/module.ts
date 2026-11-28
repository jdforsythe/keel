import { module } from "@keel/compiler";

/** The `@keel/std-offline` library manifest (std.offline, k.library): a module that declares or sends through an outbox lists the package in `deps`. */
export default module({
  id: "offline",
  deps: [],
  capabilities: ["clock", "net", "observe", "random", "storage"],
  public: {
    exports: [
      "drain",
      "Outbox",
      "outbox",
      "OutboxEntry",
      "OutboxResult",
      "resolve",
      "Resolution",
      "send",
      "SendInput",
      "Write",
      "writeFor",
    ],
  },
});
