import type { CallExpression, Expression } from "oxc-parser";

/** `<object>.<name>(...)` with a static name, else undefined. */
export function memberCall(call: CallExpression): { object: Expression; name: string } | undefined {
  const c = call.callee;
  if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return undefined;
  return { object: c.object, name: c.property.name };
}
