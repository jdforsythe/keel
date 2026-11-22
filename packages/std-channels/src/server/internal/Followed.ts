import type { Ctx } from "@keel/ctx";

/** What a followed capability reports to a follow: a committed change of its channel and key, or that delivery stopped. */
export type FollowReport = { readonly kind: "changed" } | { readonly kind: "lost" };

/**
 * A data capability accessor a channel route follows (std.channels Serve, k.data): its object has `follow(channel,
 * key, on)`, resolving to the stop once it is listening. `key` is the canonical JSON text of the stream's params.
 */
export type Followed = (ctx: Ctx) => {
  follow(
    channel: { readonly name: string; readonly params: unknown },
    key: string,
    on: (report: FollowReport) => void,
  ): Promise<() => void>;
};
