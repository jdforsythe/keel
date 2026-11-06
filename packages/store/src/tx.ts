import type { Result } from "@keel/schema";
import type { TxError } from "./internal/TxError.ts";
import { coreKey } from "./internal/coreKey.ts";
import type { Transaction } from "./types/Transaction.ts";

/**
 * Run a transaction: validate `payload` (`schema.invalid`), check the scope's `uses`
 * (`store.undeclared`), apply, check invariants (`store.invariant`), then commit and log in one batch.
 * Errors leave state and log unchanged; a throwing transaction rethrows with nothing committed.
 */
export function tx<T>(t: Transaction<T, unknown>, payload: unknown): Result<T, TxError> {
  return t[coreKey](payload);
}
