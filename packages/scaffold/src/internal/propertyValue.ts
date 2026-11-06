import type { Expression, ObjectExpression } from "oxc-parser";
import { keyName } from "./keyName.ts";

/** The value of the property named `name` in an object literal, or null. */
export function propertyValue(obj: ObjectExpression, name: string): Expression | null {
  for (const p of obj.properties) if (p.type === "Property" && keyName(p) === name) return p.value;
  return null;
}
