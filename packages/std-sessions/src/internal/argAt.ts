import type { CallExpression, Expression } from "oxc-parser";

/** The `i`th call argument when present and not a spread. */
export function argAt(call: CallExpression, i: number): Expression | undefined {
  const a = call.arguments[i];
  return a === undefined || a.type === "SpreadElement" ? undefined : a;
}
