import type { Node } from "./Node.ts";

/**
 * True when a `secret` node occurs anywhere in the tree, so `parse` must wrap raw values. A node is plain JSON data and
 * `JSON.stringify` escapes every quote inside a string, so `"kind":"secret"` appears in its text only as a node's kind.
 */
export function hasSecret(node: Node): boolean {
  return JSON.stringify(node).includes('"kind":"secret"');
}
