import type { Node } from "./Node.ts";

/** True when `x` is an AST node: an object with a string `type` and numeric `start` and `end`. */
export function isNode(x: unknown): x is Node {
  return (
    typeof x === "object" &&
    x !== null &&
    "type" in x &&
    typeof x.type === "string" &&
    "start" in x &&
    typeof x.start === "number" &&
    "end" in x &&
    typeof x.end === "number"
  );
}
