import type { SchemaNode } from "./SchemaNode.ts";

/** Strip `optional` and `nullable` wrappers. */
export function unwrapNode(node: SchemaNode): SchemaNode {
  return node.kind === "optional" || node.kind === "nullable" ? unwrapNode(node.inner) : node;
}
