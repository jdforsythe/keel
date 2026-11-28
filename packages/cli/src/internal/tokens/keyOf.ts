import type { ObjectProperty } from "oxc-parser";

/** The name a non-computed property is written with (`a`, `'a'` or `1`), else undefined. */
export function keyOf(p: ObjectProperty): string | undefined {
  if (p.computed) return undefined;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal" && (typeof p.key.value === "string" || typeof p.key.value === "number"))
    return String(p.key.value);
  return undefined;
}
