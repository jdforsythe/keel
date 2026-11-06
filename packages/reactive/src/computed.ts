import { createNode } from "./internal/createNode.ts";
import { fail } from "./internal/fail.ts";
import { track } from "./internal/track.ts";
import type { Computed } from "./types/Computed.ts";

/**
 * A lazily evaluated derived value. Recomputes only when read after a dependency changed; a result
 * `equals` the previous one (default `Object.is`) keeps the previous value and does not propagate.
 * Reading it after its scope is disposed is E1205.
 */
export function computed<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): Computed<T> {
  const equals = options?.equals ?? Object.is;
  let value: T;
  let has = false;
  const n = createNode(
    "computed",
    () => {
      const next = fn();
      if (has && equals(value, next)) return false;
      has = true;
      value = next;
      return true;
    },
    [],
  );
  return {
    get: () => {
      if (n.gone) throw fail("E1205", "read of a disposed computed");
      track(n);
      return value;
    },
  };
}
