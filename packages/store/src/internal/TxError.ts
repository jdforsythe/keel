import type { KeelError, SchemaError } from "@keel/schema";

/** Expected failures of `tx`: invalid payload or options, undeclared transaction, violated invariant, refused concurrent write. */
export type TxError =
  | SchemaError
  | KeelError<"store.undeclared", { transaction: string }>
  | KeelError<"store.invariant", { transaction: string }>
  | KeelError<"keel.conflict", { store: string; transaction: string; base: number; head: number }>;
