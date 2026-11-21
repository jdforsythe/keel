import type { Node } from "./Node.ts";
import { typeText } from "./typeText.ts";

/** Compact description: one line per field for objects (closed ones between `{|` and `|}` lines), one line otherwise; a mark appends ` pii(<class>)`. */
export function docOf(node: Node): string {
  if (node.kind !== "object") return typeText(node);
  const lines = Object.entries(node.fields).map(([k, f]) => `${k}${f.kind === "optional" ? "?" : ""}: ${typeText(f)}`);
  const text = (node.closed === true ? ["{|", ...lines, "|}"] : lines).join("\n");
  return node.pii === undefined ? text : `${text} pii(${node.pii})`;
}
