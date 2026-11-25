import type { AstNode } from "./AstNode.ts";

/** Whether `v` is a syntax tree node: an object with a string `type` and numeric `start` and `end`. */
export function isAstNode(v: unknown): v is AstNode {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    typeof v.type === "string" &&
    "start" in v &&
    typeof v.start === "number" &&
    "end" in v &&
    typeof v.end === "number"
  );
}
