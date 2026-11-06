import { coreKey } from "./internal/coreKey.ts";
import type { Store } from "./types/Store.ts";

/** Add a check run on every candidate state; a `false` makes `tx` return `store.invariant` and commit nothing. */
export function invariant<T>(target: Store<T>, check: (state: T) => boolean): void {
  target[coreKey].guard(check);
}
