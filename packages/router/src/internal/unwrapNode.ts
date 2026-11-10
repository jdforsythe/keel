import type { SchemaNode as Node } from "./SchemaNode.ts";

/** Strip `optional` and `nullable` wrappers and format types (a format param reads as its base). */
export function unwrapNode(node: Node): Node {
  if (node.kind === "format") return unwrapNode(node.base);
  return node.kind === "optional" || node.kind === "nullable" ? unwrapNode(node.inner) : node;
}
