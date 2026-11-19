import type { JSXChild } from "oxc-parser";
import { cleanJsxText } from "./cleanJsxText.ts";
import { decodeEntities } from "./decodeEntities.ts";

/**
 * The text a literal JSX child spells (JSX text after the whitespace rule, decoded; a string or number literal or
 * a template without substitutions in `{}`; an empty `{}` is ""), or null when the child is an expression or an
 * element: data, not literal text.
 */
export function literalTextOf(c: JSXChild): string | null {
  if (c.type === "JSXText") return decodeEntities(cleanJsxText(c.value));
  if (c.type !== "JSXExpressionContainer") return null;
  let e = c.expression;
  if (e.type === "JSXEmptyExpression") return "";
  while (e.type === "ParenthesizedExpression") e = e.expression;
  if (e.type === "Literal") return typeof e.value === "string" || typeof e.value === "number" ? String(e.value) : null;
  if (e.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? null;
  return null;
}
