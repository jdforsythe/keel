/** One write key a snapshot carries: the transaction's name and the key it committed with. */
type WriteKey = { readonly name: string; readonly key: string };

/**
 * The write keys a restore of `snapshot` takes (k.sync Write key): its `keys` when present, else the keys of its log
 * entries in log order. `restore` and std-sessions' hub both read a stored snapshot's keys through it.
 */
export function snapshotKeys(snapshot: {
  readonly keys?: readonly WriteKey[] | undefined;
  readonly log: readonly { readonly name: string; readonly key?: string | undefined }[];
}): readonly WriteKey[] {
  return snapshot.keys ?? snapshot.log.flatMap((e) => (e.key === undefined ? [] : [{ name: e.name, key: e.key }]));
}
