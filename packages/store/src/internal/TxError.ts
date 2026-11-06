import type { KeelError, SchemaError } from "@keel/schema";

/** Expected failures of `tx`: invalid payload, undeclared transaction, violated invariant. */
export type TxError =
  | SchemaError
  | KeelError<"store.undeclared", { transaction: string }>
  | KeelError<"store.invariant", { transaction: string }>;
