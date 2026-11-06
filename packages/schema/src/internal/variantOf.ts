import type { Node } from "./Node.ts";

/** The union variant whose literal discriminant equals `tag`, if any. */
export function variantOf(node: Extract<Node, { kind: "union" }>, tag: unknown): Node | undefined {
  return node.variants.find((v) => {
    const field = v.kind === "object" ? v.fields[node.key] : undefined;
    return field?.kind === "literal" && field.value === tag;
  });
}
