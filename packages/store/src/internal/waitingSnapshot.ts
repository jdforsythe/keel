/** Where `resume` (`@keel/runtime-dom`) holds the `#k-state` snapshots no store in its `stores` took, while islands resume. */
const WAITING = Symbol.for("keel.waitingSnapshots");

/**
 * The snapshot `resume` holds for a store `id` created while islands resume (k.resume Stores), taken once so no other
 * store gets it; undefined when none waits.
 */
export function waitingSnapshot(id: string): { readonly snapshot: unknown } | undefined {
  const waiting: unknown = Reflect.get(globalThis, WAITING);
  if (!(waiting instanceof Map) || !waiting.has(id)) return undefined;
  const snapshot: unknown = waiting.get(id);
  waiting.delete(id);
  return { snapshot };
}
