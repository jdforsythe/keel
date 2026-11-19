import type { Expression } from "oxc-parser";

/** `e` without parentheses, TS assertions and wrappers, or a comma expression's leading operands. */
export function unwrapExpression(e: Expression): Expression {
  switch (e.type) {
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
    case "TSInstantiationExpression":
    case "ChainExpression":
      return unwrapExpression(e.expression);
    case "SequenceExpression": {
      const last = e.expressions[e.expressions.length - 1];
      return last === undefined ? e : unwrapExpression(last);
    }
    default:
      return e;
  }
}
