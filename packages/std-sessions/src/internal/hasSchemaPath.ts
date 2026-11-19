import type { ShapeNode } from "./ShapeNode.ts";

/**
 * True unless the schema proves `segments` absent. A `null` segment (`*`) matches any one segment: an array index, a
 * record key, or a field of an object (then some field must hold the rest). Digits match an array index.
 */
export function hasSchemaPath(node: ShapeNode, segments: readonly (string | null)[]): boolean {
  if (segments.length === 0 || node.kind === "any") return true;
  const [seg = "", ...rest] = segments;
  if (node.kind === "leaf") return false;
  if (node.kind === "array") return (seg === null || /^\d+$/.test(seg)) && hasSchemaPath(node.item, rest);
  if (node.kind === "record") return hasSchemaPath(node.value, rest);
  if (seg === null) return node.open || [...node.fields.values()].some((f) => hasSchemaPath(f, rest));
  const field = node.fields.get(seg);
  return field === undefined ? node.open : hasSchemaPath(field, rest);
}
