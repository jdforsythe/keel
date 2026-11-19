import { createNode } from "./internal/createNode.ts";
import { fail } from "./internal/fail.ts";
import { track } from "./internal/track.ts";
import type { Computed } from "./types/Computed.ts";

/**
 * A lazily evaluated derived value. Recomputes only when read after a dependency changed; a result
 * `equals` the previous one (default `Object.is`) keeps the previous value and does not propagate.
 * A throw is its outcome until a source changes: it runs once per commit, every `get()` throws that error, and a
 * throw or the first value after one always propagates. Reading it after its scope is disposed is E1205.
 */
export function computed<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): Computed<T> {
  const equals = options?.equals ?? Object.is;
  let value: T;
  let has = false;
  let thrown: { readonly error: unknown } | null = null;
  const n = createNode(
    "computed",
    () => {
      let next: T;
      try {
        next = fn();
      } catch (error) {
        thrown = { error };
        return true;
      }
      const recovered = thrown !== null;
      thrown = null;
      if (has && !recovered && equals(value, next)) return false;
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
      if (thrown !== null) throw thrown.error;
      return value;
    },
  };
}
