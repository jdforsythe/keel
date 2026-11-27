import { records } from "./internal/records.ts";
import type { Transaction } from "./types/Transaction.ts";

/** Whether `x` is a transaction `transaction` made in this realm (k.store Guards, k.identity), read from the store's record, never from a property. */
export function isTransaction(x: unknown): x is Transaction<unknown, unknown> {
  return typeof x === "object" && x !== null && records.transaction.has(x);
}
