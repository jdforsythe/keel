/** One write of a `commit` (k.persist): `expect` is the value `key` must hold (`null`: absent); `value`, when present, is stored. */
export interface StorageWrite {
  readonly key: string;
  readonly expect: string | null;
  readonly value?: string | undefined;
}
