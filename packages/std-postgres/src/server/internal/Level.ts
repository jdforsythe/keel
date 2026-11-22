/** A transaction's isolation level as Postgres names it; `serializable` unless an `allow` gives some up. */
export type Level = "read committed" | "repeatable read" | "serializable";
