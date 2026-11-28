import type { Expression } from "oxc-parser";
import { keyOf } from "./keyOf.ts";

/** The value of property `name` of an object literal expression, or undefined. */
export function propOf(e: Expression | undefined, name: string): Expression | undefined {
  if (e?.type !== "ObjectExpression") return undefined;
  for (const p of e.properties) if (p.type === "Property" && keyOf(p) === name) return p.value;
  return undefined;
}
