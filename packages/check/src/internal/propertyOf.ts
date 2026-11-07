import type { ObjectExpression, ObjectProperty } from "oxc-parser";
import { keyName } from "./keyName.ts";

/** The property named `name` of an object literal, or `null` when absent. A spread is not searched. */
export function propertyOf(obj: ObjectExpression, name: string): ObjectProperty | null {
  for (const p of obj.properties) if (p.type === "Property" && keyName(p) === name) return p;
  return null;
}
