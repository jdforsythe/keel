import { createNode } from "./internal/createNode.ts";
import { dispose } from "./internal/dispose.ts";
import { disposeOwned } from "./internal/disposeOwned.ts";
import { fail } from "./internal/fail.ts";
import { rt } from "./internal/rt.ts";
import { owner } from "./owner.ts";
import type { Scope } from "./types/Scope.ts";

/**
 * Run `fn` inside a new ownership scope. Primitives created during `fn` (and inside their
 * computations) belong to it. If `fn` throws, the scope is disposed and that error rethrown (not one a dispose hook
 * throws).
 * `onError` receives, after the commit, errors thrown by effects and computeds owned by this scope or
 * its descendants (unless a nearer scope declares one); the throwing effect does not run again.
 * `run(fn)` re-enters the scope later (see `Scope.run`). A `detached` scope is a root: no owner disposes it or lends
 * it an `onError`, its `parent` is undefined, and `fn` runs untracked (writes are still checked), so only its own
 * `dispose()` ends it. With no owner running and no `detached`, `scope` raises the E1208 defect: outside kernel and
 * test code a root exists only where the compiler makes a module root (`moduleRoot`).
 */
export function scope(
  fn: () => void,
  options?: { readonly onError?: (error: unknown) => void; readonly detached?: boolean },
): Scope {
  const detached = options?.detached === true;
  if (!detached && rt.owner === null)
    throw fail(
      "E1208",
      "scope() with no owner outside a module root; nest it, run it in a captured scope, or in a test pass detached: true",
    );
  const outer = { owner: rt.owner, reaction: rt.reaction };
  if (detached) rt.owner = null;
  const n = createNode("scope", undefined, []);
  rt.owner = outer.owner;
  const handle: Scope = {
    dispose: () => dispose(n),
    parent: detached ? undefined : owner(),
    onDispose(f) {
      if (n.gone) f();
      else n.hooks = [...(n.hooks ?? []), f];
    },
    run<T>(f: () => T): T {
      if (n.gone) throw fail("E1206", "run on a disposed scope");
      const prev = { owner: rt.owner, reaction: rt.reaction };
      rt.owner = n;
      // Untracked, not unchecked: a disposed copy of the running computation. `track` ignores gone
      // reactions, so reads subscribe nothing; writes are still checked against its `writes` (E1201).
      rt.reaction = prev.reaction && { ...prev.reaction, gone: true };
      let out: { readonly value: T } | { readonly error: unknown };
      try {
        out = { value: f() };
      } catch (error) {
        out = { error };
      }
      rt.owner = prev.owner;
      rt.reaction = prev.reaction;
      // Disposed from inside `f`: free what the rest of `f` created. An error of `f` wins over a hook's.
      if (n.gone) {
        try {
          disposeOwned(n);
        } catch (error) {
          if ("value" in out) throw error;
        }
      }
      if ("error" in out) throw out.error;
      return out.value;
    },
  };
  n.handle = handle;
  n.onError = options?.onError;
  rt.owner = n;
  // Untracked like `run`: a disposed copy of the running computation subscribes nothing but still checks writes.
  if (detached) rt.reaction = outer.reaction && { ...outer.reaction, gone: true };
  try {
    fn();
  } catch (err) {
    // The error of `fn` wins over one a dispose hook throws.
    try {
      dispose(n);
    } catch {}
    throw err;
  } finally {
    rt.owner = outer.owner;
    rt.reaction = outer.reaction;
  }
  // Disposed from inside `fn`: free what the rest of `fn` created.
  if (n.gone) disposeOwned(n);
  return handle;
}
