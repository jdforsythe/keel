import type { PlainFields } from "./PlainFields.ts";
import { resultBrand } from "./resultBrand.ts";

/**
 * The own properties of `x` when it is a plain object (k.schema Plain data): its prototype is `Object.prototype` or
 * `null`, each own key is a string other than the three prototype keys, and each own property is enumerable and holds
 * a value; the brand `ok` and `err` put on a Result (non-enumerable, holding `true`) is no key here. Otherwise
 * `undefined`. Read through `Reflect.ownKeys` and one property descriptor per key, so no getter runs; the descriptor
 * is the one read that tells a data property from an accessor, and its value is the one read of the value.
 */
export function plainEntries(x: unknown): PlainFields | undefined {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return undefined;
  const proto: unknown = Reflect.getPrototypeOf(x);
  if (proto !== Object.prototype && proto !== null) return undefined;
  const own = Reflect.ownKeys(x);
  const keys: string[] = [];
  const values: unknown[] = [];
  for (let i = 0; i < own.length; i++) {
    const key = own[i];
    if (key === undefined) return undefined;
    const d = Reflect.getOwnPropertyDescriptor(x, key);
    if (typeof key !== "string") {
      if (key === resultBrand && d?.enumerable === false && d.value === true) continue;
      return undefined;
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
    if (d === undefined || d.enumerable !== true || !("value" in d)) return undefined;
    keys.push(key);
    values.push(d.value);
  }
  return { keys, values };
}
