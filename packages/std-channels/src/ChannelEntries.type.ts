import type { PublishEntry } from "./internal/PublishEntry.ts";
import type { StreamEntry } from "./internal/StreamEntry.ts";

/**
 * The contract entries a channel is served at (std.contracts), written in the serving module's `contract`: at `Id`
 * the event stream, an `events: true` API GET, and at `Pub` (none without `message`) the publish POST, both on the
 * channel's path with its `params` as `query`.
 */
export type ChannelEntries<P, M, Id extends string, Pub extends string> = {
  readonly [K in Id]: StreamEntry<P, M>;
} & {
  readonly [K in Pub]: PublishEntry<P, M>;
};
