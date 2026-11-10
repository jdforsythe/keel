import { type Program, Visitor } from "oxc-parser";

const memo = new WeakMap<Program, ReadonlySet<string>>();

/** Every name a program reads as `.<name>` (static member access, optional chains included). */
export function memberNames(program: Program): ReadonlySet<string> {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const out = new Set<string>();
  new Visitor({
    MemberExpression: (n) => {
      if (!n.computed && n.property.type === "Identifier") out.add(n.property.name);
    },
  }).visit(program);
  memo.set(program, out);
  return out;
}
