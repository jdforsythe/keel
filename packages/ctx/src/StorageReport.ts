/**
 * What a storage's `watch` reports (k.persist Watch): `committed` names the `keel.store.` keys, sorted, that a `true`
 * commit through another storage object stored (never a value); `lost` comes once when delivery stops.
 */
export type StorageReport =
  | { readonly kind: "committed"; readonly keys: readonly string[] }
  | { readonly kind: "lost" };
