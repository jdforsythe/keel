import type { Expression, JSXAttribute } from "oxc-parser";

/** The expression inside `name={expr}`, if the attribute has one. */
export function exprOf(at: JSXAttribute | undefined): Expression | undefined {
  const v = at?.value;
  if (v === undefined || v === null || v.type !== "JSXExpressionContainer") return undefined;
  return v.expression.type === "JSXEmptyExpression" ? undefined : v.expression;
}
