import type { Schema } from "@keel/schema";
import type { ColumnKind } from "../ColumnKind.ts";

type Node = Schema<unknown>["node"];

const isText = (n: Node): boolean => n.kind === "string" || n.kind === "id" || (n.kind === "format" && isText(n.base));

/** A field's column kind from its schema node: a string or a format whose JSON is a string is `text`. */
export function kindOf(n: Node): ColumnKind {
  if (isText(n)) return "text";
  if (n.kind === "int" || n.kind === "number") return "number";
  if (n.kind === "enum" || n.kind === "boolean") return n.kind;
  return "value";
}
