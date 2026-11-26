/** `v` frozen, with the own, non-enumerable mark `key` a key guard reads (`Object.hasOwn(v, key)`). */
export function markedFrozen<T extends object>(v: T, key: symbol): Readonly<T> {
  return Object.freeze(Object.defineProperty(v, key, { value: true }));
}
