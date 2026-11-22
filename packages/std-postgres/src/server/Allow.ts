/**
 * What a `transaction` gives up (std.postgres): `'write skew'` runs it at `repeatable read`, `'lost updates'` at
 * `read committed`, which gives up both.
 */
export type Allow = "write skew" | "lost updates";
