import type { Expression } from "oxc-parser";
import { keyName } from "./keyName.ts";

/**
 * The breakpoint keys of a style prop value: `["base"]` for a string or plain template literal, the keys of an
 * object literal, `null` for anything not readable statically (a computed key or a spread included).
 */
export function styleKeys(e: Expression): readonly string[] | null {
  if (e.type === "Literal") return typeof e.value === "string" ? ["base"] : null;
  if (e.type === "TemplateLiteral") return e.expressions.length === 0 ? ["base"] : null;
  if (e.type !== "ObjectExpression") return null;
  const keys: string[] = [];
  for (const p of e.properties) {
    const name = p.type === "Property" ? keyName(p) : null;
    if (name === null) return null;
    keys.push(name);
  }
  return keys;
}
