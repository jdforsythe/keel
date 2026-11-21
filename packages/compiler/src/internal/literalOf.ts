import type { Expression } from "oxc-parser";
import { unwrapExpression } from "../globals/unwrapExpression.ts";
import type { Literal } from "./Literal.ts";

/**
 * The literal `e` is, through parentheses and `as`/`satisfies`: a string (or a template with no expressions), a
 * boolean, or `null` for `null` and `undefined`; undefined for anything else, a name included.
 */
export function literalOf(e: Expression): Literal | undefined {
  const v = unwrapExpression(e);
  if (v.type === "Literal" && (typeof v.value === "string" || typeof v.value === "boolean" || v.value === null))
    return { value: v.value };
  if (v.type === "Identifier" && v.name === "undefined") return { value: null };
  if (v.type === "TemplateLiteral" && v.expressions.length === 0) {
    const cooked = v.quasis[0]?.value.cooked;
    if (typeof cooked === "string") return { value: cooked };
  }
  return undefined;
}
