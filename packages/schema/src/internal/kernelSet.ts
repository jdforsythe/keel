/** The realm's kernel record: one map of named sets under `Symbol.for('keel.kernel')`, defined once, never replaced. */
const KEY = Symbol.for("keel.kernel");

function record(): Map<string, WeakSet<object>> {
  const held: unknown = Reflect.get(globalThis, KEY);
  if (held instanceof Map) return held;
  const made = new Map<string, WeakSet<object>>();
  Object.defineProperty(globalThis, KEY, { value: made });
  return made;
}

/**
 * The set named `name` in the realm's kernel record (k.identity): what a maker made, shared by every copy of a kernel
 * package loaded in this realm and exported by no entry. A guard is `kernelSet(name).has(x)`.
 */
export function kernelSet(name: string): WeakSet<object> {
  const sets = record();
  const held = sets.get(name);
  if (held !== undefined) return held;
  const made = new WeakSet<object>();
  sets.set(name, made);
  return made;
}
