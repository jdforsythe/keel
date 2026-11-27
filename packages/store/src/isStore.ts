import { records } from "./internal/records.ts";
import type { Store } from "./types/Store.ts";

/** Whether `x` is a store `store` made in this realm (k.store Guards, k.identity), read from the store's record, never from a property. */
export function isStore(x: unknown): x is Store<unknown> {
  return typeof x === "object" && x !== null && records.store.has(x);
}
