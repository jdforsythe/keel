import { type CallExpression, type Program, Visitor } from "oxc-parser";

/** Every call expression of a program, in source order. */
export function callsIn(program: Program): CallExpression[] {
  const out: CallExpression[] = [];
  new Visitor({ CallExpression: (n) => void out.push(n) }).visit(program);
  return out;
}
