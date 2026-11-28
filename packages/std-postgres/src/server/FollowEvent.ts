/** What a `follow` reports (std.postgres-changes): a committed change of its capability, channel and key, or that delivery stopped. */
export type FollowEvent = { readonly kind: "changed" } | { readonly kind: "lost" };
