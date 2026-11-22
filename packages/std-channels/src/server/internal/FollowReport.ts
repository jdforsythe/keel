/** What a followed capability reports to a follow: a committed change of its channel and key, or that delivery stopped. */
export type FollowReport = { readonly kind: "changed" } | { readonly kind: "lost" };
