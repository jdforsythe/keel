import type { Held } from "./Held.ts";
import { heldSet } from "./heldSet.ts";

const freeze = Object.freeze;

/**
 * A new, empty record (k.identity): a `WeakSet` no caller sees, reached through the built-ins read at evaluation
 * (k.realm Built-ins). The record a package's makers write is a binding of that package's own module; this function
 * returns a fresh one, never another's.
 */
export function madeRecord(): Held {
  const set = heldSet<object>();
  return freeze({
    has: (x: unknown): boolean => (typeof x === "object" || typeof x === "function") && x !== null && set.has(x),
    add: (x: object): void => {
      set.add(x);
    },
  });
}
