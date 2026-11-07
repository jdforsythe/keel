import type { ObjectProperty } from "oxc-parser";

/** The key name of a non-computed property (`a` or `'a'`), else `null`. */
export function keyName(p: ObjectProperty): string | null {
  if (p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal" && typeof p.key.value === "string") return p.key.value;
  return null;
}
