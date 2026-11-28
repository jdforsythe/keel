/** Where `resume` (`@keel/runtime-dom`) holds the `#k-state` snapshots no store in its `stores` took, while islands resume. */
const WAITING = Symbol.for("keel.waitingSnapshots");
/** What a store leaves in place of a waiting snapshot its schema refuses; `resume` warns E1253 for it. */
const REFUSED = Symbol.for("keel.refusedSnapshot");

/**
 * The snapshot `resume` holds for a store `id` created while islands resume (k.resume Stores); undefined when none
 * waits. `take` removes it so no other store gets it; `refuse` marks it as one the store's schema refuses, which
 * `resume` reports as an E1253 warning.
 */
export function waitingSnapshot(
  id: string,
): { readonly snapshot: unknown; readonly take: () => void; readonly refuse: () => void } | undefined {
  const waiting: unknown = Reflect.get(globalThis, WAITING);
  if (!(waiting instanceof Map) || !waiting.has(id)) return undefined;
  const snapshot: unknown = waiting.get(id);
  if (snapshot === REFUSED) return undefined;
  return { snapshot, take: () => void waiting.delete(id), refuse: () => void waiting.set(id, REFUSED) };
}
