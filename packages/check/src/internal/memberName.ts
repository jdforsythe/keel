import type { Expression } from "oxc-parser";

/** The member name of a static or literal-keyed member expression (`a.b`, `a['b']`), else null. */
export function memberName(e: Expression): string | null {
  if (e.type !== "MemberExpression") return null;
  if (!e.computed) return e.property.type === "Identifier" ? e.property.name : null;
  return e.property.type === "Literal" && typeof e.property.value === "string" ? e.property.value : null;
}
