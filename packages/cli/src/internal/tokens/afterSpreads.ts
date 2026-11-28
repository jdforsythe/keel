import type { ObjectExpression, ObjectProperty } from "oxc-parser";
import { keyOf } from "./keyOf.ts";

/** The property of `obj` named `key` written after its last spread, or undefined. */
export function afterSpreads(obj: ObjectExpression, key: string): ObjectProperty | undefined {
  const lastSpread = obj.properties.reduce((at, p, i) => (p.type === "SpreadElement" ? i : at), -1);
  for (const p of obj.properties.slice(lastSpread + 1)) if (p.type === "Property" && keyOf(p) === key) return p;
  return undefined;
}
