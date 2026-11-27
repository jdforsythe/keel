import type { WeakMapOf } from "./WeakMapOf.ts";

// Read once, while this module is evaluated (k.realm Built-ins).
const Weak = WeakMap;
const { get, set, has, delete: remove } = WeakMap.prototype;
const apply = Reflect.apply;
const freeze = Object.freeze;

/**
 * A new `WeakMap` reached only through the methods read at evaluation (k.realm Built-ins): what a kernel package
 * keeps per object, so a later write to `WeakMap.prototype` changes none of it.
 */
export function heldMap<K extends object, V>(): WeakMapOf<K, V> {
  const map = new Weak<K, V>();
  const held: WeakMapOf<K, V> = freeze({
    get: (key: K): V | undefined => apply(get, map, [key]),
    set: (key: K, value: V): WeakMapOf<K, V> => {
      apply(set, map, [key, value]);
      return held;
    },
    has: (key: K): boolean => apply(has, map, [key]),
    delete: (key: K): boolean => apply(remove, map, [key]),
  });
  return held;
}
