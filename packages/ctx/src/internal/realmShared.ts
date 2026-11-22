/**
 * The realm's one WeakMap under `Symbol.for(name)`: every copy of `@keel/ctx` (a test harness's fresh module graph
 * evaluates one of its own) keeps per-ctx state in the same map. Made on first use.
 */
export function realmShared<K extends object, V>(name: string): WeakMap<K, V> {
  const key = Symbol.for(name);
  const shared: unknown = Reflect.get(globalThis, key);
  if (shared instanceof WeakMap) return shared;
  const made = new WeakMap<K, V>();
  Reflect.set(globalThis, key, made);
  return made;
}
