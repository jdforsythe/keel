import type { JSXAttributeItem } from "oxc-parser";

/**
 * The JSX attribute `name` written as `name="x"`, `name={"x"}` or `name={`x`}`: `{ text, start, end }` with the
 * value's offsets; `null` for any other value; `undefined` when the attribute is absent.
 */
export function jsxLiteral(
  attrs: readonly JSXAttributeItem[],
  name: string,
): { readonly text: string; readonly start: number; readonly end: number } | null | undefined {
  for (const a of attrs) {
    if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== name) continue;
    const v = a.value;
    if (v?.type === "Literal" && typeof v.value === "string") return { text: v.value, start: v.start, end: v.end };
    if (v?.type !== "JSXExpressionContainer") return null;
    const e = v.expression;
    if (e.type === "Literal" && typeof e.value === "string") return { text: e.value, start: v.start, end: v.end };
    const cooked = e.type === "TemplateLiteral" && e.expressions.length === 0 ? e.quasis[0]?.value.cooked : undefined;
    return typeof cooked === "string" ? { text: cooked, start: v.start, end: v.end } : null;
  }
  return undefined;
}
