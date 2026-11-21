/** A transaction's isolation level (std.postgres); `read committed` when none is given. */
export type Isolation = "read committed" | "repeatable read" | "serializable";
