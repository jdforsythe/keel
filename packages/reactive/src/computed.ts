import { createNode } from "./internal/createNode.ts";
import { fail } from "./internal/fail.ts";
import { track } from "./internal/track.ts";
import type { Computed } from "./types/Computed.ts";

/**
 * A lazily evaluated derived value. Recomputes only when read after a dependency changed; a result
 * `equals` the previous one (default `Object.is`) keeps the previous value and does not propagate.
 * A throw (from `fn` or from `equals`) is its outcome until a source it read changes: it runs once per commit, every
 * `get()` throws that error, and a throw or the first value after one always propagates. Reading it after its scope
 * is disposed is E1205; disposing it drops its value and its error.
 */
export function computed<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): Computed<T> {
  const equals = options?.equals ?? Object.is;
  let kept: { readonly value: T } | null = null;
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
      if (kept !== null && !recovered) {
        let same: boolean;
        try {
          same = equals(kept.value, next);
        } catch (error) {
          thrown = { error };
          return true;
        }
        if (same) return false;
      }
      kept = { value: next };
      return true;
    },
    [],
  );
  n.hooks = [
    () => {
      kept = null;
      thrown = null;
    },
  ];
  return {
    get: () => {
      if (n.gone) throw fail("E1205", "read of a disposed computed");
      track(n);
      if (thrown !== null) throw thrown.error;
      // Only a disposed computed has neither: a live one has run by now.
      if (kept === null) throw fail("E1205", "read of a disposed computed");
      return kept.value;
    },
  };
}
