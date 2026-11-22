/** What a `follow` reports (std.postgres): a committed change of its capability, channel and key, or that delivery stopped. */
export type FollowEvent = { readonly kind: "changed" } | { readonly kind: "lost" };
