import type { SchemaNode as Node } from "./SchemaNode.ts";

/** Strip `optional` and `nullable` wrappers. */
export function unwrap(node: Node): Node {
  return node.kind === "optional" || node.kind === "nullable" ? unwrap(node.inner) : node;
}
