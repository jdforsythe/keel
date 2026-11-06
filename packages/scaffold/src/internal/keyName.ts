import type { ObjectPropertyKind } from "oxc-parser";

/** The static key of an object property (`a`, `'a'`), or null for spreads and computed keys. */
export function keyName(p: ObjectPropertyKind): string | null {
  if (p.type !== "Property" || p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal" && typeof p.key.value === "string") return p.key.value;
  return null;
}
