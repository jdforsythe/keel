/**
 * One `ctx.storage` value holding a store snapshot (k.persist Server saves): `raw` is the stored JSON, `null` when
 * absent, and `json` its parse (parsed once per stored text; each request restores its own instance from `json`, and
 * `restore` copies, never mutates). `raw` is the `expect` of the save that follows.
 */
export type Saved = { readonly raw: string | null; readonly json: unknown };
