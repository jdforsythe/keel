import type { Node } from "./Node.ts";
import { disposeOwned } from "./disposeOwned.ts";
import { rt } from "./rt.ts";
import { unlink } from "./unlink.ts";

/** Dispose `n` and everything it owns. Idempotent. */
export function dispose(n: Node): void {
  if (n.gone) return;
  n.gone = true;
  rt.nodes.delete(n);
  const owner = n.owner;
  if (owner && !owner.gone) {
    const i = owner.owned.indexOf(n);
    if (i >= 0) owner.owned.splice(i, 1);
  }
  disposeOwned(n);
  unlink(n);
}
