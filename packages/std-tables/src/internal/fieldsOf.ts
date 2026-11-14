import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];

/** The fields of an `s.object` node; any other node has none. */
export function fieldsOf(n: Node): Readonly<Record<string, Node>> {
  return n.kind === "object" ? n.fields : {};
}
