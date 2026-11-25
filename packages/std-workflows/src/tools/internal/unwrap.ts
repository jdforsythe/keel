import type { Expression } from "oxc-parser";

/** The expression under parentheses, `as` and `satisfies`, so `'a' as const` reads as `'a'`. */
export function unwrap(e: Expression | null | undefined): Expression | undefined {
  let x = e ?? undefined;
  while (x?.type === "ParenthesizedExpression" || x?.type === "TSAsExpression" || x?.type === "TSSatisfiesExpression")
    x = x.expression;
  return x;
}
