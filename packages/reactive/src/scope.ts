import { createNode } from "./internal/createNode.ts";
import { dispose } from "./internal/dispose.ts";
import { disposeOwned } from "./internal/disposeOwned.ts";
import { rt } from "./internal/rt.ts";
import type { Scope } from "./types/Scope.ts";

/**
 * Run `fn` inside a new ownership scope. Primitives created during `fn` (and inside their
 * computations) belong to it. If `fn` throws, the scope is disposed and the error rethrown.
 */
export function scope(fn: () => void): Scope {
  const n = createNode("scope", undefined, []);
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
  return { dispose: () => dispose(n) };
}
