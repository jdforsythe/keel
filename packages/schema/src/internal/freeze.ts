const isObject = (x: unknown): x is object => typeof x === "object" && x !== null;

/**
 * Freezes `v` and every object and array reachable from it by own data properties, each once, at any depth without
 * recursion, and returns `v`. No getter runs: a container is read through its descriptors, but for an array in
 * `copies` (one `seal` built from a plain array's items, so every index holds a value), whose items are read directly.
 * Throws on a value that cannot be frozen (a typed array with elements, a revoked Proxy); a value that passed a
 * JSON-shaped schema check never does.
 */
export function freeze<T>(v: T, copies: ReadonlySet<object> = new Set()): T {
  const seen = new Set<object>();
  for (const todo: object[] = isObject(v) ? [v] : []; todo.length > 0; ) {
    const o = todo.pop();
    if (o === undefined || seen.has(o)) continue;
    seen.add(o);
    Object.freeze(o);
    if (Array.isArray(o) && copies.has(o)) {
      for (const item of o) if (isObject(item)) todo.push(item);
    } else for (const d of Object.values(Object.getOwnPropertyDescriptors(o))) if (isObject(d.value)) todo.push(d.value);
  }
  return v;
}
