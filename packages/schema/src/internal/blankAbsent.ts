import type { Node } from "./Node.ts";
import { isBlank } from "./isBlank.ts";

const needsContent = (node: Node): boolean =>
  node.kind === "secret"
    ? needsContent(node.inner)
    : node.kind === "format"
      ? needsContent(node.base)
      : node.kind === "string" && node.min >= 1;

/** True when `value` is blank (`isBlank`) and `inner` (an optional key's node) is a `string` with `min` >= 1. */
export function blankAbsent(inner: Node, value: unknown): boolean {
  return typeof value === "string" && isBlank(value) && needsContent(inner);
}
