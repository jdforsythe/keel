import type { Node } from "./Node.ts";
import { dispose } from "./dispose.ts";

/** Dispose everything `n` owns, leaving `n` itself alive. */
export function disposeOwned(n: Node): void {
  const kids = n.owned;
  n.owned = [];
  for (const k of kids) dispose(k);
}
