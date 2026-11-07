/**
 * Who sent one request (k.server Server state): `token` is the `keel-caller` cookie value, or one minted for a write
 * that came without it (then `fresh`, set as a cookie on its response by `issueCaller`), else `""` (a cookieless read).
 */
export type Caller = { readonly token: string; readonly fresh: boolean };
