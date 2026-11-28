import type { ApiAction, Loader } from "@keel/router";
import type { ChannelEvent } from "../ChannelEvent.ts";

/**
 * The handlers `channelRoute` returns (std.contracts), each bound by the serving module's `manifest` at its entry:
 * `loader`, the live loader of the event stream at `Id`, and `action`, the publish action at `Pub` (none without
 * `message`).
 */
export type ChannelRoute<M, Id extends string, Pub extends string> = {
  readonly loader: Loader<Id, ChannelEvent<M>, true>;
} & {
  readonly [K in Pub as "action"]: ApiAction<K, Record<string, never>>;
};
