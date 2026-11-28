import type { Schema } from "@keel/schema";
import type { Concurrent } from "./internal/Concurrent.ts";
import { coreKey } from "./internal/coreKey.ts";
import type { Store } from "./types/Store.ts";
import type { Transaction } from "./types/Transaction.ts";

/**
 * Declare a named, typed, pure transaction on `target`. `fn` must not read `ctx` or globals (E1302)
 * and must return a new state; names are unique per store and key the log. `concurrent` (default `'reject'`) decides
 * a write whose `base` is not the store's head: `'reject'` refuses it with `keel.conflict`, `'rebase'` applies it to the
 * current state and keeps `base` on its entry.
 */
export function transaction<T, P>(
  target: Store<T>,
  name: string,
  payload: Schema<P>,
  fn: (state: T, payload: P) => T,
  options?: { readonly concurrent?: Concurrent },
): Transaction<T, P> {
  return target[coreKey].define(name, payload, fn, options?.concurrent ?? "reject");
}
