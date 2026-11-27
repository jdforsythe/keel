/**
 * A server store's log as its deployable's storage holds it (k.e2e Served `log`): `head`, the store's count of
 * changes; `digest`, the SHA-256 hex of the stored snapshot's text byte for byte; and each kept entry's id, transaction
 * name and `digest` (the SHA-256 hex of its payload's JSON), oldest first. No payload or value: equal digests show
 * equal stored bytes without showing personal data.
 */
export type StoreLog = {
  readonly head: number;
  readonly digest: string;
  readonly entries: readonly { readonly id: number; readonly name: string; readonly digest: string }[];
};
