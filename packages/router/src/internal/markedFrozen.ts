/**
 * `v` marked with the own symbol `key` and frozen. The mark is enumerable, so a spread copy (`{ ...loader, live }`)
 * keeps it as it keeps every other field; a symbol key is in no `Object.keys`, JSON or `for...in`.
 */
export function markedFrozen<T extends object>(v: T, key: symbol): Readonly<T> {
  return Object.freeze(Object.defineProperty(v, key, { value: true, enumerable: true }));
}
