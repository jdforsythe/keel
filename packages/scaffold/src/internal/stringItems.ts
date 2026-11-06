import type { ArrayExpression } from "oxc-parser";

/** The string literal elements of an array literal, in order. */
export function stringItems(arr: ArrayExpression): string[] {
  const out: string[] = [];
  for (const e of arr.elements) if (e?.type === "Literal" && typeof e.value === "string") out.push(e.value);
  return out;
}
