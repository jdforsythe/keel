import type { ObjectProperty } from "oxc-parser";

/** A key's name: an identifier, a string or a number, or computed from a string or number literal (`['a.b']`). */
export function keyOf(p: ObjectProperty): string | null {
  const k = p.key;
  if (!p.computed && k.type === "Identifier") return k.name;
  if (k.type === "Literal" && (typeof k.value === "string" || typeof k.value === "number")) return String(k.value);
  return null;
}
