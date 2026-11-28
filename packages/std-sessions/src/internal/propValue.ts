import type { Expression, ObjectExpression } from "oxc-parser";

/** The value expression of the non-computed property `name` (identifier or string key) of an object literal. */
export function propValue(obj: ObjectExpression, name: string): Expression | undefined {
  for (const p of obj.properties) {
    if (p.type !== "Property" || p.computed) continue;
    const k = p.key;
    const key =
      k.type === "Identifier" ? k.name : k.type === "Literal" && typeof k.value === "string" ? k.value : undefined;
    if (key === name) return p.value;
  }
  return undefined;
}
