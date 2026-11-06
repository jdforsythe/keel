import type { Node } from "./Node.ts";

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const TRUE = ["true", "on", "1"];
const FALSE = ["false", "off", "0"];

/** Coerce one string for a leaf node. Text that does not fit is returned unchanged so validation reports it. */
export function leafFromString(node: Node, text: string): unknown {
  switch (node.kind) {
    case "number":
    case "int":
      return NUMERIC.test(text) ? Number(text) : text;
    case "boolean":
      return TRUE.includes(text) ? true : FALSE.includes(text) ? false : text;
    case "literal":
      return String(node.value) === text ? node.value : text;
    default:
      return text;
  }
}
