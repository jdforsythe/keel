import type { Node } from "./Node.ts";
import { secretPathOf } from "./secretPathOf.ts";

/** True when a `secret` node occurs anywhere in the tree, so `parse` must wrap raw values. */
export function hasSecret(node: Node): boolean {
  return secretPathOf(node) !== null;
}
