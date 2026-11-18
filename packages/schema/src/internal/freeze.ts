/**
 * Freezes `v` and every object and array reachable from it by own data properties, each once, at any depth without
 * recursion, and returns `v`. No getter runs. Throws on a value that cannot be frozen (a typed array with elements, a
 * revoked Proxy); a value that passed a JSON-shaped schema check never does.
 */
export function freeze<T>(v: T): T {
  const seen = new Set<unknown>();
  for (const todo: unknown[] = [v]; todo.length > 0; ) {
    const o = todo.pop();
    if (typeof o === "object" && o !== null && !seen.has(o)) {
      seen.add(o);
      Object.freeze(o);
      for (const d of Object.values(Object.getOwnPropertyDescriptors(o))) todo.push(d.value);
    }
  }
  return v;
}
