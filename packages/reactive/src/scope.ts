import { createNode } from "./internal/createNode.ts";
import { dispose } from "./internal/dispose.ts";
import { disposeOwned } from "./internal/disposeOwned.ts";
import { fail } from "./internal/fail.ts";
import { rt } from "./internal/rt.ts";
import { owner } from "./owner.ts";
import type { Scope } from "./types/Scope.ts";

/**
 * Run `fn` inside a new ownership scope. Primitives created during `fn` (and inside their
 * computations) belong to it. If `fn` throws, the scope is disposed and the error rethrown.
 * `onError` receives, after the commit, errors thrown by effects and computeds owned by this scope or
 * its descendants (unless a nearer scope declares one); the throwing effect does not run again.
 * `run(fn)` re-enters the scope later (see `Scope.run`).
 */
export function scope(fn: () => void, options?: { onError?: (error: unknown) => void }): Scope {
  const n = createNode("scope", undefined, []);
  const handle: Scope = {
    dispose: () => dispose(n),
    parent: owner(),
    onDispose(f) {
      if (n.gone) f();
      else n.hooks = [...(n.hooks ?? []), f];
    },
    run(f) {
      if (n.gone) throw fail("E1206", "run on a disposed scope");
      const prev = { owner: rt.owner, reaction: rt.reaction };
      rt.owner = n;
      // Untracked, not unchecked: a disposed copy of the running computation. `track` ignores gone
      // reactions, so reads subscribe nothing; writes are still checked against its `writes` (E1201).
      rt.reaction = prev.reaction && { ...prev.reaction, gone: true };
      try {
        return f();
      } finally {
        rt.owner = prev.owner;
        rt.reaction = prev.reaction;
        // Disposed from inside `f`: free what the rest of `f` created.
        if (n.gone) disposeOwned(n);
      }
    },
  };
  n.handle = handle;
  n.onError = options?.onError;
  const prev = rt.owner;
  rt.owner = n;
  try {
    fn();
  } catch (err) {
    dispose(n);
    throw err;
  } finally {
    rt.owner = prev;
  }
  // Disposed from inside `fn`: free what the rest of `fn` created.
  if (n.gone) disposeOwned(n);
  return handle;
}
