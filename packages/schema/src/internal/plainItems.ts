/**
 * The items of `x` when it is a plain array (k.schema Plain data): `Array.isArray` holds, its prototype is
 * `Array.prototype`, and its own keys are `length` and each index below it, each index enumerable and holding a value.
 * Otherwise `undefined`. Read through `Reflect.ownKeys` and property descriptors only, so no getter runs.
 */
export function plainItems(x: unknown): readonly unknown[] | undefined {
  if (!Array.isArray(x) || Reflect.getPrototypeOf(x) !== Array.prototype) return undefined;
  const keys = Reflect.ownKeys(x);
  const n = keys.length - 1;
  // An array's own keys are its indices in order, then `length`, then any other key: `length` last means no other.
  if (keys[n] !== "length" || Reflect.getOwnPropertyDescriptor(x, "length")?.value !== n) return undefined;
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const key = keys[i];
    if (key !== `${i}`) return undefined;
    const d = Reflect.getOwnPropertyDescriptor(x, key);
    if (d === undefined || d.enumerable !== true || !("value" in d)) return undefined;
    out.push(d.value);
  }
  return out;
}
