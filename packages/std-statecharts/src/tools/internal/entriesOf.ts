import type { Node } from "./Node.ts";
import { isNode } from "./isNode.ts";

/**
 * The properties of an object literal as `{ name, key, value }`, or undefined when `x` is not an object literal or one
 * of its keys is not a literal (a spread, a computed key, a method).
 */
export function entriesOf(
  x: Node | undefined,
): { readonly name: string; readonly key: Node; readonly value: Node }[] | undefined {
  if (x?.type !== "ObjectExpression" || !Array.isArray(x.properties)) return undefined;
  const out: { name: string; key: Node; value: Node }[] = [];
  for (const p of x.properties) {
    if (!isNode(p) || p.type !== "Property" || p.computed === true || p.method === true || p.kind !== "init")
      return undefined;
    const { key, value } = p;
    if (!isNode(key) || !isNode(value)) return undefined;
    const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? key.value : undefined;
    if (typeof name !== "string") return undefined;
    out.push({ name, key, value });
  }
  return out;
}
