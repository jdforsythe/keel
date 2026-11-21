/** Shared by every runtime copy in the realm, so a harness's fresh module graph sees the mark too. */
const KEY = Symbol.for("keel.harnessCtx");

/**
 * The ctxs a test harness renders with (`@keel/testing`): a host element rendered on one never runs its code
 * (k.host-element Harness and replay).
 */
export function harnessed(): WeakSet<object> {
  const shared: unknown = Reflect.get(globalThis, KEY);
  if (shared instanceof WeakSet) return shared;
  const made = new WeakSet<object>();
  Reflect.set(globalThis, KEY, made);
  return made;
}
