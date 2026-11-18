import type { Expression } from "oxc-parser";

function unparen(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" ? unparen(e.expression) : e;
}

/**
 * A call that renders a slot: `slots.<name>()`, `<props>.children()`, a `children` binding (`children()`), or with
 * `props` (the component's first parameter) a call of its direct member (`props.icon()`, k.place); optional calls
 * too, alone or left of `??`. It returns nodes, so it is inserted as content, never bound as text.
 */
export function isSlotCall(e: Expression, props?: string): boolean {
  if (e.type === "LogicalExpression" && e.operator === "??") return isSlotCall(unparen(e.left), props);
  const x = e.type === "ChainExpression" ? e.expression : e;
  if (x.type !== "CallExpression") return false;
  const c = x.callee;
  if (c.type === "Identifier") return c.name === "children";
  if (c.type !== "MemberExpression" || c.computed) return false;
  if (c.property.name === "children") return true;
  return c.object.type === "Identifier" && (c.object.name === "slots" || c.object.name === props);
}
