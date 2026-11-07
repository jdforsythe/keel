/**
 * The deployable's in-process copy of one `ctx.storage` key holding a store snapshot (k.server Server state): `raw`
 * is the stored JSON, `null` when absent, and `json` its parse (RFC 0054: parsed once per stored version, when it is
 * read from storage or saved; each request restores its own instance from `json`, and `restore` copies, never
 * mutates). Every save replaces the object, so identity is its version.
 */
export type Saved = { readonly raw: string | null; readonly json: unknown };
