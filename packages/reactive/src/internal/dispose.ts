import type { Node } from "./Node.ts";
import { disposeOwned } from "./disposeOwned.ts";
import { rt } from "./rt.ts";
import { runAll } from "./runAll.ts";
import { unlink } from "./unlink.ts";

/**
 * Dispose `n` and everything it owns, then run its hooks. Idempotent. A throwing hook does not stop it: every owned
 * node is disposed and every hook runs, then the first error in disposal order (owned nodes first, then `n`'s hooks)
 * is rethrown.
 */
export function dispose(n: Node): void {
  if (n.gone) return;
  n.gone = true;
  rt.nodes.delete(n);
  const owner = n.owner;
  if (owner && !owner.gone) {
    const i = owner.owned.indexOf(n);
    if (i >= 0) owner.owned.splice(i, 1);
  }
  const hooks = n.hooks ?? [];
  n.hooks = undefined;
  runAll<() => void>([() => disposeOwned(n), () => unlink(n), ...hooks], (f) => f());
}
