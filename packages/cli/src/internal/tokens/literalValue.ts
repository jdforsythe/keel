import type { Expression } from "oxc-parser";
import type { Val } from "./Val.ts";
import { keyOf } from "./keyOf.ts";

/** The string, or `{ light, dark }` pair of strings, an expression writes; undefined for anything else. */
export function literalValue(e: Expression): Val | undefined {
  if (e.type === "Literal" && typeof e.value === "string") return e.value;
  if (e.type !== "ObjectExpression") return undefined;
  let light: string | undefined;
  let dark: string | undefined;
  for (const p of e.properties) {
    if (p.type !== "Property") return undefined;
    const v = p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : undefined;
    if (keyOf(p) === "light") light = v;
    else if (keyOf(p) === "dark") dark = v;
  }
  return light === undefined || dark === undefined ? undefined : { light, dark };
}
