import type { WeakSetOf } from "./WeakSetOf.ts";

// Read once, while this module is evaluated (k.realm Built-ins).
const Weak = WeakSet;
const { has, add, delete: remove } = WeakSet.prototype;
const apply = Reflect.apply;
const freeze = Object.freeze;

/**
 * A new `WeakSet` reached only through the methods read at evaluation (k.realm Built-ins), so a later write to
 * `WeakSet.prototype` changes none of it.
 */
export function heldSet<T extends object>(): WeakSetOf<T> {
  const set = new Weak<T>();
  const held: WeakSetOf<T> = freeze({
    has: (value: T): boolean => apply(has, set, [value]),
    add: (value: T): WeakSetOf<T> => {
      apply(add, set, [value]);
      return held;
    },
    delete: (value: T): boolean => apply(remove, set, [value]),
  });
  return held;
}
