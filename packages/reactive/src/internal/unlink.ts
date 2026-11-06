import type { Node } from "./Node.ts";

/** Drop every subscription `n` holds on its sources. */
export function unlink(n: Node): void {
  for (const s of n.sources) {
    const i = s.observers.indexOf(n);
    if (i >= 0) s.observers.splice(i, 1);
  }
  n.sources = [];
}
