/**
 * Who sent one request (k.server Server state): `token` is the `keel-caller` cookie value, or one minted for a write
 * that came without it (then `fresh`, set as a cookie on its response by `issueCaller`), else `""` (a cookieless read).
 * `id` is what loaders and actions get as `caller`: the token's hash (`callerHasher`, RFC 0054), never the token.
 */
export type Caller = { readonly token: string; readonly fresh: boolean; readonly id: string };
