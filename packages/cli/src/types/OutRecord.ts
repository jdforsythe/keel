/** One output record. Every record has a `kind`; each kind has exactly one formatter (k.cli). */
export type OutRecord = { readonly kind: string; readonly [field: string]: unknown };
