import { type ObjectExpression, type Program, Visitor } from "oxc-parser";

/** The object literal passed at `index` to the first call of the free function `callee` (`module({...})`), or null. */
export function callArgObject(program: Program, callee: string, index = 0): ObjectExpression | null {
  let found: ObjectExpression | null = null;
  new Visitor({
    CallExpression: (n) => {
      if (found !== null || n.callee.type !== "Identifier" || n.callee.name !== callee) return;
      const a = n.arguments[index];
      if (a?.type === "ObjectExpression") found = a;
    },
  }).visit(program);
  return found;
}
