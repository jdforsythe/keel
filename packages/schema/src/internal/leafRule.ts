import type { Node } from "./Node.ts";
import type { Rule } from "./Rule.ts";

/** The rule a scalar value breaks for a scalar node, or undefined when it fits (or the node is a container). */
export function leafRule(node: Node, x: unknown): Rule | undefined {
  switch (node.kind) {
    case "string":
      if (typeof x !== "string") return "type";
      if (x.length < node.min) return "min";
      return node.max !== undefined && x.length > node.max ? "max" : undefined;
    case "number":
      if (typeof x !== "number") return "type";
      return Number.isFinite(x) ? undefined : "finite";
    case "int":
      if (typeof x !== "number") return "type";
      return Number.isSafeInteger(x) ? undefined : "int";
    case "boolean":
      return typeof x === "boolean" ? undefined : "type";
    case "literal":
      return x === node.value ? undefined : "literal";
    case "enum":
      if (typeof x !== "string") return "type";
      return node.values.includes(x) ? undefined : "enum";
    case "id":
      if (typeof x !== "string") return "type";
      return x.length > 0 ? undefined : "min";
    default:
      return undefined;
  }
}
