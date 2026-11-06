import type { Node } from "./Node.ts";
import { unlink } from "./unlink.ts";

/** Dispose `n` and everything it owns. Idempotent. */
export function dispose(n: Node): void {
  if (n.gone) return;
  n.gone = true;
  const owner = n.owner;
  if (owner && !owner.gone) {
    const i = owner.owned.indexOf(n);
    if (i >= 0) owner.owned.splice(i, 1);
  }
  const kids = n.owned;
  n.owned = [];
  for (const k of kids) dispose(k);
  unlink(n);
}
