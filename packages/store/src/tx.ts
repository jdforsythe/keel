import type { Result } from "@keel/schema";
import type { TxError } from "./internal/TxError.ts";
import { coreKey } from "./internal/coreKey.ts";
import type { Transaction } from "./types/Transaction.ts";
import type { TxOptions } from "./types/TxOptions.ts";

/**
 * Run a transaction: validate `payload`, `meta`, `base` and `key` (`schema.invalid`), check the scope's `uses`
 * (`store.undeclared`); a `key` the store's `keys` holds for `t` returns `ok` with nothing committed; a `base` other than `head()`
 * under `'reject'` is `keel.conflict`; else apply, check invariants (`store.invariant`), then commit and log in one batch.
 * Errors leave state, log and head unchanged; a throwing transaction rethrows with nothing committed.
 * On a store in the module registry, a check `@keel/server` installs throws E1256 first while it serves a request.
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
  return t[coreKey](payload, options);
}
