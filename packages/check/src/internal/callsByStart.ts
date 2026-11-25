import { type CallExpression, type Program, Visitor } from "oxc-parser";

const memo = new WeakMap<Program, ReadonlyMap<number, CallExpression>>();

/** The call expressions of `program` by their start offset. */
export function callsByStart(program: Program): ReadonlyMap<number, CallExpression> {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const out = new Map<number, CallExpression>();
  new Visitor({ CallExpression: (n) => void out.set(n.start, n) }).visit(program);
  memo.set(program, out);
  return out;
}
