/**
 * A server store's log as its deployable's storage holds it (k.e2e Served `log`): `head`, the store's count of
 * changes, and each kept entry's id and transaction name, oldest first; no payload.
 */
export type StoreLog = {
  readonly head: number;
  readonly entries: readonly { readonly id: number; readonly name: string }[];
};
