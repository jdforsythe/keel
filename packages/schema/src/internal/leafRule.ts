import type { Node } from "./Node.ts";
import type { Rule } from "./Rule.ts";

function bound(node: { readonly min?: number; readonly max?: number }, x: number): Rule | undefined {
  if (node.min !== undefined && x < node.min) return "min";
  return node.max !== undefined && x > node.max ? "max" : undefined;
}

/** The rule a scalar value breaks for a scalar node, or undefined when it fits (or the node is a container). */
export function leafRule(node: Node, x: unknown): Rule | undefined {
  switch (node.kind) {
    case "string":
      if (typeof x !== "string") return "type";
      if (node.min >= 1 && !/\S/.test(x)) return "required";
      if (x.length < node.min) return "min";
      return node.max !== undefined && x.length > node.max ? "max" : undefined;
    case "number":
      if (typeof x !== "number") return "type";
      return Number.isFinite(x) ? bound(node, x) : "finite";
    case "int":
      if (typeof x !== "number") return "type";
      return Number.isSafeInteger(x) ? bound(node, x) : "int";
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
