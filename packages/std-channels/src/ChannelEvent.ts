/**
 * What a channel stream delivers (std.channels): `reset` first on every open (re-read; nothing missed is resent),
 * `saved` after each save of a store the channel's `stores` creates, `changed` after each committed change a followed
 * capability reports (naming nothing), `message` per publish to the same channel and params, and `closed` before the
 * end. No event names a caller or holds store state.
 */
export type ChannelEvent<M> =
  | { readonly kind: "reset" }
  | { readonly kind: "saved"; readonly store: string; readonly head: number }
  | { readonly kind: "changed" }
  | { readonly kind: "message"; readonly message: M }
  | { readonly kind: "closed"; readonly reason: "denied" | "full" };
