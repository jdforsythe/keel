import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type Expression, type Program, Visitor } from "oxc-parser";

type Name = Extract<Expression, { type: "Identifier" }>;
type Span = { readonly start: number; readonly end: number };
const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/**
 * `span` and the spans of the functions of `program` it calls by name, transitively: a function declaration or a
 * `const` function named as a callee inside any span already reached. A callee it cannot bind to a function of the
 * file (an import, a parameter, a member) adds none.
 */
export function reachedFunctions(program: Program, span: Span): Span[] {
  const calls: Name[] = [];
  new Visitor({
    CallExpression: (n) => {
      const c = unwrapExpression(n.callee);
      if (c.type === "Identifier") calls.push(c);
    },
  }).visit(program);
  const g = globalRefs(program);
  const spans: Span[] = [span];
  for (let i = 0; i < spans.length; i++) {
    const from = spans[i];
    if (from === undefined) break;
    for (const c of calls) {
      if (c.start < from.start || c.start >= from.end) continue;
      const fn = g.functionOf(c.name, c.start) ?? g.initOf(c);
      if (FUNCTIONS.has(fn.type) && !spans.some((s) => s.start === fn.start))
        spans.push({ start: fn.start, end: fn.end });
    }
  }
  return spans;
}
