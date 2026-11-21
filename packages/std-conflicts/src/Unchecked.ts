/**
 * A rebased entry `id` of `store` whose base state cannot be rebuilt (std.conflicts): `folded` when its `base` is older
 * than the kept log, `undo` when an undo lies between the kept log's start and it.
 */
export interface Unchecked {
  readonly store: string;
  readonly id: number;
  readonly reason: "folded" | "undo";
}
