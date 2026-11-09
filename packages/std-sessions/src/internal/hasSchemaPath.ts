import type { ShapeNode } from "./ShapeNode.ts";

/** True unless the schema proves `segments` absent (`*` or digits match an array index). */
export function hasSchemaPath(node: ShapeNode, segments: readonly string[]): boolean {
  if (segments.length === 0 || node.kind === "any") return true;
  const [seg = "", ...rest] = segments;
  if (node.kind === "leaf") return false;
  if (node.kind === "array") return (seg === "*" || /^\d+$/.test(seg)) && hasSchemaPath(node.item, rest);
  const field = node.fields.get(seg);
  return field === undefined ? node.open : hasSchemaPath(field, rest);
}
