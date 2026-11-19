import { blankAbsent } from "@keel/schema/internal";
import type { Node } from "./Node.ts";
import type { Reading } from "./Reading.ts";
import { unwrap } from "./unwrap.ts";

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const TRUE = ["true", "on", "1"];
const FALSE = ["false", "off", "0"];

/**
 * Coerce element text for a field node, following the k.schema decodeStrings table: empty text for an
 * optional key is absent (as is whitespace-only text for a `string` with `min` >= 1), for a nullable key null; text that does not fit stays raw so validation reports it.
 */
export function coerceText(node: Node, text: string): Reading {
  const leaf = unwrap(node);
  if (text === "") {
    if (node.kind === "optional") return { kind: "absent" };
    if (node.kind === "nullable") return { kind: "value", value: null };
    return leaf.kind === "string" ? { kind: "value", value: "" } : { kind: "absent" };
  }
  if (node.kind === "optional" && blankAbsent(node.inner, text)) return { kind: "absent" };
  switch (leaf.kind) {
    case "string":
    case "id":
      return { kind: "value", value: text };
    case "number":
    case "int":
      return NUMERIC.test(text) ? { kind: "value", value: Number(text) } : { kind: "raw", text };
    case "boolean":
      if (TRUE.includes(text)) return { kind: "value", value: true };
      return FALSE.includes(text) ? { kind: "value", value: false } : { kind: "raw", text };
    case "literal":
      return String(leaf.value) === text ? { kind: "value", value: leaf.value } : { kind: "raw", text };
    case "enum":
      return leaf.values.includes(text) ? { kind: "value", value: text } : { kind: "raw", text };
    default:
      return { kind: "raw", text };
  }
}
