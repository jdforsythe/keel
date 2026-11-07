import type { Result } from "@keel/schema";
import type { TxError } from "./internal/TxError.ts";
import { coreKey } from "./internal/coreKey.ts";
import type { Transaction } from "./types/Transaction.ts";
import type { TxOptions } from "./types/TxOptions.ts";

/**
 * Run a transaction: validate `payload` and `meta` (`schema.invalid`), check the scope's `uses`
 * (`store.undeclared`), apply, check invariants (`store.invariant`), then commit and log in one batch.
 * Errors leave state and log unchanged; a throwing transaction rethrows with nothing committed.
 * `payload` is typed by the transaction's schema; a value typed `unknown` (wire data, a log entry) is also accepted
 * and validated at run time.
 */
export function tx<T, P>(t: Transaction<T, P>, payload: NoInfer<P>, options?: TxOptions): Result<T, TxError>;
export function tx<T, A>(
  t: Transaction<T, unknown>,
  payload: unknown extends A ? A : never,
  options?: TxOptions,
): Result<T, TxError>;
export function tx<T>(t: Transaction<T, unknown>, payload: unknown, options?: TxOptions): Result<T, TxError> {
  return t[coreKey](payload, options?.meta);
}
