/** A log `diag` record (docs/OUTPUT.md) the server emits, e.g. E1554; a throw's carries its app `frames` (k.server Log). */
export type Diag = { readonly code: string; readonly message: string; readonly frames?: readonly string[] };
