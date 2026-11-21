import type { Node } from "./Node.ts";
import { isNode } from "./isNode.ts";

const WRAPPERS = new Set(["ParenthesizedExpression", "TSAsExpression", "TSSatisfiesExpression"]);

/** The expression under parentheses, `as` and `satisfies`, so `'a' as const` reads as `'a'`. */
export function unwrap(x: unknown): Node | undefined {
  let n = isNode(x) ? x : undefined;
  while (n !== undefined && WRAPPERS.has(n.type)) n = isNode(n.expression) ? n.expression : undefined;
  return n;
}
