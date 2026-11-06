import type { Node } from "./internal/Node.ts";
import { State } from "./internal/State.ts";
import { dispose } from "./internal/dispose.ts";
import { rt } from "./internal/rt.ts";
import type { Scope } from "./types/Scope.ts";

/**
 * Run `fn` inside a new ownership scope. Primitives created during `fn` (and inside their
 * computations) belong to it. If `fn` throws, the scope is disposed and the error rethrown.
 */
export function scope(fn: () => void): Scope {
  const owner = rt.owner;
  const n: Node = {
    fn: undefined,
    sources: [],
    observers: [],
    state: State.Clean,
    effect: false,
    owner,
    owned: [],
    writes: [],
    gone: false,
  };
  owner?.owned.push(n);
  rt.owner = n;
  try {
    fn();
  } catch (err) {
    dispose(n);
    throw err;
  } finally {
    rt.owner = owner;
  }
  return { dispose: () => dispose(n) };
}
