/** One part of a sharded vitest run (`--shard=<index>/<count>`), 1-based. */
export type TestShard = {
  readonly index: number;
  readonly count: number;
};
