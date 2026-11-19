import type { Expression } from "oxc-parser";

function unparen(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" ? unparen(e.expression) : e;
}

/**
 * A call that renders a slot: `slots.<name>()`, `<props>.children()` (RFC 0008), or a `children` binding
 * (`children()`); optional calls too. It returns nodes, so it is inserted as a node, never bound as text (D31).
 */
export function isSlotCall(e: Expression): boolean {
  if (e.type === "LogicalExpression" && e.operator === "??") return isSlotCall(unparen(e.left));
  const x = e.type === "ChainExpression" ? e.expression : e;
  if (x.type !== "CallExpression") return false;
  const c = x.callee;
  if (c.type === "Identifier") return c.name === "children";
  if (c.type !== "MemberExpression" || c.computed) return false;
  if (c.property.name === "children") return true;
  return c.object.type === "Identifier" && c.object.name === "slots";
}
