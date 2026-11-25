import { resultBrand } from "./resultBrand.ts";

/**
 * The own entries of `x` when it is a plain object (k.schema Plain data): its prototype is `Object.prototype` or
 * `null`, each own key is a string other than the three prototype keys, and each own property is enumerable and holds
 * a value; the brand `ok` and `err` put on a Result (non-enumerable, holding `true`) is no key here. Otherwise
 * `undefined`. Read through `Reflect.ownKeys` and property descriptors only, so no getter runs.
 */
export function plainEntries(x: unknown): readonly (readonly [string, unknown])[] | undefined {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return undefined;
  const proto: unknown = Reflect.getPrototypeOf(x);
  if (proto !== Object.prototype && proto !== null) return undefined;
  const out: (readonly [string, unknown])[] = [];
  for (const key of Reflect.ownKeys(x)) {
    const d = Reflect.getOwnPropertyDescriptor(x, key);
    if (key === resultBrand && d?.enumerable === false && d.value === true) continue;
    if (typeof key !== "string" || key === "__proto__" || key === "constructor" || key === "prototype")
      return undefined;
    if (d === undefined || d.enumerable !== true || !("value" in d)) return undefined;
    out.push([key, d.value]);
  }
  return out;
}
