import type { Node } from "./Node.ts";
import { typeText } from "./typeText.ts";

/** Compact description: one line per field for objects, one line otherwise. */
export function docOf(node: Node): string {
  if (node.kind !== "object") return typeText(node);
  return Object.entries(node.fields)
    .map(([k, f]) => `${k}${f.kind === "optional" ? "?" : ""}: ${typeText(f)}`)
    .join("\n");
}
