/** A serve's proxy (k.e2e Answered origins): `server` for a browser context's `proxy` option. */
export type ProxyServer = { readonly server: string; close(): Promise<void> };
