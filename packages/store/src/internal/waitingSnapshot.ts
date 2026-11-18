/** Where `resume` (`@keel/runtime-dom`) holds the `#k-state` snapshots no store in its `stores` took, while islands resume. */
const WAITING = Symbol.for("keel.waitingSnapshots");

/**
 * The snapshot `resume` holds for a store `id` created while islands resume (k.resume Stores), and `take`, which removes
 * it so no other store gets it; undefined when none waits. A snapshot left untaken is an E1253 warning of `resume`.
 */
export function waitingSnapshot(id: string): { readonly snapshot: unknown; readonly take: () => void } | undefined {
  const waiting: unknown = Reflect.get(globalThis, WAITING);
  if (!(waiting instanceof Map) || !waiting.has(id)) return undefined;
  return { snapshot: waiting.get(id), take: () => void waiting.delete(id) };
}
