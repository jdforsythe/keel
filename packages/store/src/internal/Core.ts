import type { Schema } from "@keel/schema";
import type { Transaction } from "../types/Transaction.ts";

/** Store-private hooks: define a transaction, add an invariant. */
export interface Core<T> {
  define<P>(name: string, payload: Schema<P>, fn: (state: T, payload: P) => T): Transaction<T, P>;
  guard(check: (state: T) => boolean): void;
}
