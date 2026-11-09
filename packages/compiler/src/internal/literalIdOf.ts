import type { Argument } from "oxc-parser";

/** The literal string `id` of an object literal argument (`Button({ id: "cart.buy", … })`); undefined otherwise. */
export function literalIdOf(arg: Argument | undefined): string | undefined {
  if (arg === undefined || arg.type !== "ObjectExpression") return undefined;
  for (const p of arg.properties) {
    if (p.type !== "Property" || p.computed) continue;
    const named = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : undefined;
    if (named !== "id") continue;
    return p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : undefined;
  }
  return undefined;
}
