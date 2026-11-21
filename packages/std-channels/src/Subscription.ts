import type { ChannelStatus } from "./ChannelStatus.ts";

/** What `subscribe` returns: `status()` reads a signal; `close()` ends the subscription as disposing its scope does. */
export interface Subscription {
  status(): ChannelStatus;
  close(): void;
}
