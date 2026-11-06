import type { Operation } from "../types/Operation.ts";
import type { SchemaNode } from "./SchemaNode.ts";

const unwrap = (n: SchemaNode): SchemaNode => (n.kind === "optional" || n.kind === "nullable" ? unwrap(n.inner) : n);

/** Input fields of an operation with their unwrapped node (optional/nullable stripped). */
export function fieldsOf(op: Operation): ReadonlyMap<string, SchemaNode> {
  const node = op.input.node;
  if (node.kind !== "object") return new Map();
  return new Map(Object.entries(node.fields).map(([k, n]) => [k, unwrap(n)]));
}
