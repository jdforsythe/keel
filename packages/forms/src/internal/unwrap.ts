import type { Node } from "./Node.ts";

/** Strip `optional` and `nullable` wrappers and format types (a format field reads and writes as its base). */
export function unwrap(node: Node): Node {
  if (node.kind === "format") return unwrap(node.base);
  return node.kind === "optional" || node.kind === "nullable" ? unwrap(node.inner) : node;
}
