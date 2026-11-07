/**
 * Who sent one request (k.server Server state, RFC 0054, 0057): `id` is what loaders and actions get as `caller`, the
 * hash of the caller cookie's value when the server signed it (`callerSigner`), else of a value minted for a write that
 * came without one, else `""` (a cookieless read). `set` is the `set-cookie` header `issueCaller` puts on the minting
 * write's response, else `""`. The cookie value itself never reaches app code.
 */
export type Caller = { readonly id: string; readonly set: string };
