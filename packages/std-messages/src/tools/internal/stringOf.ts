import type { Expression } from "oxc-parser";
import { unwrap } from "./unwrap.ts";

/**
 * A string literal or a template without substitutions: its value, its source text between the quotes and that
 * text's offset in the file; `undefined` for any other expression.
 */
export function stringOf(e: Expression): { value: string; raw: string; at: number } | undefined {
  const x = unwrap(e);
  if (x.type === "Literal" && typeof x.value === "string")
    return { value: x.value, raw: (x.raw ?? "").slice(1, -1), at: x.start + 1 };
  if (x.type !== "TemplateLiteral" || x.expressions.length > 0) return undefined;
  const q = x.quasis[0];
  return q === undefined ? undefined : { value: q.value.cooked ?? q.value.raw, raw: q.value.raw, at: x.start + 1 };
}
