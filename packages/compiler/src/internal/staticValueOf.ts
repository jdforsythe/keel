import type { JSXAttributeValue } from "oxc-parser";

/**
 * Literal value of a JSX attribute, if it is static. `encoded` is true for JSX string attributes,
 * whose entities are still undecoded (`a&amp;b`); false for JS literals inside `{}` (decoded).
 * A missing value (`<input disabled>`) is `{ text: "", encoded: false, bare: true }`.
 */
export function staticValueOf(
  v: JSXAttributeValue | null,
): { text: string; encoded: boolean; bare: boolean } | undefined {
  if (v === null) return { text: "", encoded: false, bare: true };
  if (v.type === "Literal") return { text: v.value, encoded: true, bare: false };
  if (v.type !== "JSXExpressionContainer") return undefined;
  const e = v.expression;
  if (e.type === "Literal" && (typeof e.value === "string" || typeof e.value === "number"))
    return { text: String(e.value), encoded: false, bare: false };
  if (e.type === "TemplateLiteral" && e.expressions.length === 0) {
    const q = e.quasis[0];
    if (q !== undefined && typeof q.value.cooked === "string")
      return { text: q.value.cooked, encoded: false, bare: false };
  }
  return undefined;
}
