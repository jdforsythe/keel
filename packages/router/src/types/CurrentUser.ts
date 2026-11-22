/**
 * A live loader's `currentUser()` (k.user): who the request the stream opened with belongs to now. `fixed` is true when
 * it answers the stream's own `user` and runs nothing (no identity source, a verified `x-keel-user`, `renderRoute`'s
 * `user`, a direct call), so a caller can leave its check out.
 */
export type CurrentUser = (() => Promise<string>) & { readonly fixed: boolean };
