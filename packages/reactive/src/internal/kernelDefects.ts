/** The realm's kernel record, as `@keel/schema` keeps it: named sets under `Symbol.for('keel.kernel')`. */
const KEY = Symbol.for("keel.kernel");

/**
 * The record's `defect` set (k.identity): a defect the engine raises is one `isDefect` of any `@keel/schema` copy in
 * this realm knows. The engine does not depend on `@keel/schema`, so it reads the record itself.
 */
export function kernelDefects(): WeakSet<object> {
  const held: unknown = Reflect.get(globalThis, KEY);
  const sets = held instanceof Map ? held : new Map<unknown, unknown>();
  if (!(held instanceof Map)) Object.defineProperty(globalThis, KEY, { value: sets });
  const set: unknown = sets.get("defect");
  if (set instanceof WeakSet) return set;
  const made = new WeakSet<object>();
  sets.set("defect", made);
  return made;
}
