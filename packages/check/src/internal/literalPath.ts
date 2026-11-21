import type { ObjectExpression, StringLiteral } from "oxc-parser";
import { propertyOf } from "./propertyOf.ts";

/** The literal `path` of an entry object (a string starting with `/`) and its node, or `null`. */
export function literalPath(entry: ObjectExpression): { readonly text: string; readonly at: StringLiteral } | null {
  const v = propertyOf(entry, "path")?.value;
  if (v?.type !== "Literal" || typeof v.value !== "string" || !v.value.startsWith("/")) return null;
  return { text: v.value, at: v };
}
