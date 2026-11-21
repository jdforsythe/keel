import type { Node } from "./Node.ts";
import { dispose } from "./dispose.ts";
import { runAll } from "./runAll.ts";

/**
 * Dispose everything `n` owns, leaving `n` itself alive. A throwing dispose hook does not stop it: every owned node is
 * disposed, then the first error in disposal order is rethrown.
 */
export function disposeOwned(n: Node): void {
  const kids = n.owned;
  n.owned = [];
  runAll(kids, dispose);
}
