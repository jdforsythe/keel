import { module } from "@keel/compiler";

/**
 * The `@keel/std-channels` stdlib module manifest (std.channels, k.module): a module that declares, serves or follows
 * a channel lists the package in `deps`; a serving module lists the channel route in its manifest.
 */
export default module({
  id: "channels",
  deps: [],
  capabilities: ["clock", "net", "observe"],
  public: { exports: ["channel", "subscribe", "publish", "server"], routes: [] },
});
