import { type Expression, type Program, Visitor } from "oxc-parser";
import type { BrandLiteral } from "./BrandLiteral.ts";

/** `s.id` (callee `s.id`) or `<expr>.random.id` (callee `*.random.id`). */
function isIdCall(callee: Expression): boolean {
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (callee.property.name !== "id") return false;
  const o = callee.object;
  if (o.type === "Identifier") return o.name === "s";
  return (
    o.type === "MemberExpression" && !o.computed && o.property.type === "Identifier" && o.property.name === "random"
  );
}

/** Every literal first argument of an `s.id(...)` or `*.random.id(...)` call, in source order. */
export function brandLiterals(ast: Program, source: string): BrandLiteral[] {
  const out: BrandLiteral[] = [];
  new Visitor({
    CallExpression: (n) => {
      const arg = n.arguments[0];
      if (!isIdCall(n.callee) || arg === undefined) return;
      if (arg.type === "Literal" && typeof arg.value === "string")
        out.push({ value: arg.value, quote: source.charAt(arg.start), start: arg.start, end: arg.end });
      else if (arg.type === "TemplateLiteral" && arg.expressions.length === 0) {
        const cooked = arg.quasis[0]?.value.cooked;
        if (typeof cooked === "string") out.push({ value: cooked, quote: "`", start: arg.start, end: arg.end });
      }
    },
  }).visit(ast);
  return out.sort((a, b) => a.start - b.start);
}
