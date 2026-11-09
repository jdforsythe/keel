import type { Argument } from "oxc-parser";

/** The literal string `id` of an object literal argument (`Button({ id: "cart.buy", … })`); undefined otherwise, or when a later spread or second `id` could override it. */
export function literalIdOf(arg: Argument | undefined): string | undefined {
  if (arg === undefined || arg.type !== "ObjectExpression") return undefined;
  let id: string | undefined;
  let seen = false;
  for (const p of arg.properties) {
    if (p.type !== "Property") {
      if (seen) return undefined;
      continue;
    }
    if (p.computed) continue;
    const named = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : undefined;
    if (named !== "id") continue;
    if (seen) return undefined;
    seen = true;
    id = p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : undefined;
  }
  return id;
}
