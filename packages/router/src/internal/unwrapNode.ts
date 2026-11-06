import type { SchemaNode as Node } from "./SchemaNode.ts";

/** Strip `optional` and `nullable` wrappers. */
export function unwrapNode(node: Node): Node {
  return node.kind === "optional" || node.kind === "nullable" ? unwrapNode(node.inner) : node;
}
