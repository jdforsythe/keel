import type { ObjectPropertyKind } from "oxc-parser";

/** The static name of an object literal property (`a` or `"a"`), or undefined for a spread or computed key. */
export function keyOf(p: ObjectPropertyKind): string | undefined {
  if (p.type !== "Property" || p.computed) return undefined;
  if (p.key.type === "Identifier") return p.key.name;
  return p.key.type === "Literal" && typeof p.key.value === "string" ? p.key.value : undefined;
}
