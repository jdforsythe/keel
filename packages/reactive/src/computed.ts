import { createNode } from "./internal/createNode.ts";
import { track } from "./internal/track.ts";
import type { Computed } from "./types/Computed.ts";

/**
 * A lazily evaluated derived value. Recomputes only when read after a dependency changed;
 * an `Object.is`-equal result does not propagate. Once its scope is disposed, `get` just calls `fn`.
 */
export function computed<T>(fn: () => T): Computed<T> {
  let value: T;
  const n = createNode(
    () => {
      const next = fn();
      const changed = !Object.is(next, value);
      value = next;
      return changed;
    },
    false,
    [],
  );
  return {
    get: () => {
      if (n.gone) return fn();
      track(n);
      return value;
    },
  };
}
