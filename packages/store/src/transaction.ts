import type { Schema } from "@keel/schema";
import { coreKey } from "./internal/coreKey.ts";
import type { Store } from "./types/Store.ts";
import type { Transaction } from "./types/Transaction.ts";

/**
 * Declare a named, typed, pure transaction on `target`. `fn` must not read `ctx` or globals (E1302)
 * and must return a new state; names are unique per store and key the log.
 */
export function transaction<T, P>(
  target: Store<T>,
  name: string,
  payload: Schema<P>,
  fn: (state: T, payload: P) => T,
): Transaction<T, P> {
  return target[coreKey].define(name, payload, fn);
}
