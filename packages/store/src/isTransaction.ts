import { TRANSACTION_KEY } from "./internal/TRANSACTION_KEY.ts";
import type { Transaction } from "./types/Transaction.ts";

/** Whether `x` is a transaction `transaction` made (k.store Guards): a key guard on `Symbol.for('keel.transaction')`. */
export function isTransaction(x: unknown): x is Transaction<unknown, unknown> {
  return typeof x === "object" && x !== null && Object.hasOwn(x, TRANSACTION_KEY);
}
