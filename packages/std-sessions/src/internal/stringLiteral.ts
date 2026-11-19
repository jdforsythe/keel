import type { Expression } from "oxc-parser";

/** The value of a string literal expression, else undefined. */
export function stringLiteral(e: Expression | undefined | null): string | undefined {
  if (e === undefined || e === null) return undefined;
  return e.type === "Literal" && typeof e.value === "string" ? e.value : undefined;
}
