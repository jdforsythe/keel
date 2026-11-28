import type { Expression } from "oxc-parser";

/** Strips parentheses and TS `as` / `satisfies` / `!` wrappers. */
export function unwrap(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression" || e.type === "TSNonNullExpression") return unwrap(e.expression);
  if (e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression") return unwrap(e.expression);
  return e;
}
