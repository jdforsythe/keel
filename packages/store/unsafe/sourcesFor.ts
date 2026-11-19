import type { Sources } from "../src/internal/Sources.ts";
import type { Transaction } from "../src/types/Transaction.ts";
import { unsafe } from "./unsafe.ts";

/** Restore the types of a transaction's declared function and invariants from `declaredSources`. */
export function sourcesFor<T, P>(
  _t: Transaction<T, P>,
  entry: { readonly fn: object; readonly guards: readonly object[] },
): Sources<T, P> {
  return unsafe(
    "declaredSources is filled only by define for this transaction, with its own fn and its store's guards",
    () => ({
      fn: entry.fn as (state: T, payload: P) => T,
      invariants: [...entry.guards] as ((state: T) => boolean)[],
    }),
  );
}
