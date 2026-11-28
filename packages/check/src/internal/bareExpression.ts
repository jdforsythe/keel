import ts from "typescript";

/** `e` without the parentheses around it. */
export const bareExpression = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) ? bareExpression(e.expression) : e;
