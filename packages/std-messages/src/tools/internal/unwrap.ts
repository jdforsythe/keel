import type { Expression } from "oxc-parser";

/** `x as T`, `x satisfies T` and `(x)` unwrapped. */
export function unwrap(e: Expression): Expression {
  let x = e;
  while (x.type === "TSAsExpression" || x.type === "TSSatisfiesExpression" || x.type === "ParenthesizedExpression")
    x = x.expression;
  return x;
}
