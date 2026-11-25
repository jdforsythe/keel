import { Visitor } from "oxc-parser";
import type { Expression, Program } from "oxc-parser";
import type { ReadFn } from "./ReadFn.ts";

/** The expressions `fn` returns (none of a nested function's); `null` for a bare `return`. */
export function returned(fn: ReadFn, program: Program): (Expression | null)[] {
  if (fn.type === "ArrowFunctionExpression" && fn.expression && fn.body.type !== "BlockStatement") return [fn.body];
  const body = fn.body;
  if (body === null) return [];
  const nested: { start: number; end: number }[] = [];
  const out: { at: number; arg: Expression | null }[] = [];
  const inner = (n: { start: number; end: number }): void => {
    if (n.start > body.start && n.end <= body.end) nested.push(n);
  };
  new Visitor({
    FunctionDeclaration: inner,
    FunctionExpression: inner,
    ArrowFunctionExpression: inner,
    ReturnStatement: (r) => {
      if (r.start >= body.start && r.end <= body.end) out.push({ at: r.start, arg: r.argument });
    },
  }).visit(program);
  return out.filter((r) => !nested.some((n) => r.at > n.start && r.at < n.end)).map((r) => r.arg);
}
