import type { SchemaNode } from "./SchemaNode.ts";

/** Top-level field names and nodes of an object schema node (empty for any other kind). */
export function fieldsOf(node: SchemaNode): readonly (readonly [string, SchemaNode])[] {
  return node.kind === "object" ? Object.entries(node.fields) : [];
}
