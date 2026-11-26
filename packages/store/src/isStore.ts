import { STORE_KEY } from "./internal/STORE_KEY.ts";
import type { Store } from "./types/Store.ts";

/** Whether `x` is a store `store` made (k.store Guards): a key guard on `Symbol.for('keel.store')`. */
export function isStore(x: unknown): x is Store<unknown> {
  return typeof x === "object" && x !== null && Object.hasOwn(x, STORE_KEY);
}
