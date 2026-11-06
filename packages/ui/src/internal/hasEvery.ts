/** Type guard: `o` holds a string for every one of `keys`. */
export function hasEvery<K extends string>(o: Partial<Record<K, string>>, keys: readonly K[]): o is Record<K, string> {
  return keys.every((k) => typeof o[k] === "string");
}
