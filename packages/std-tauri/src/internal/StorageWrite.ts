/** One write of a `commit` (k.persist): `expect` the value the key must hold (`null`: absent); without `value` it is a condition only. */
export interface StorageWrite {
  readonly key: string;
  readonly expect: string | null;
  readonly value?: string | undefined;
}
