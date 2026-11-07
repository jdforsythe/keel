/**
 * The deployable's in-process copy of one `ctx.storage` key holding a store snapshot (k.server Server state): `raw`
 * is the stored JSON, `null` when absent. Every save replaces the object, so identity is its version.
 */
export type Saved = { readonly raw: string | null };
