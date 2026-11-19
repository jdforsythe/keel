import { type BindingPattern, type BindingRestElement, type Expression, type Program, Visitor } from "oxc-parser";

/** Assignment operators whose value is the right operand. */
const ASSIGN: ReadonlySet<string> = new Set(["=", "||=", "&&=", "??="]);

/** Each name a pattern binds, at its offset: `{ a, b: [c], ...d }` -> a, c, d. */
function names(p: BindingPattern | BindingRestElement, out: { name: string; at: number }[]): void {
  if (p.type === "Identifier") out.push({ name: p.name, at: p.start });
  else if (p.type === "ObjectPattern")
    for (const x of p.properties) names(x.type === "RestElement" ? x.argument : x.value, out);
  else if (p.type === "ArrayPattern") {
    for (const x of p.elements) if (x !== null) names(x, out);
  } else names(p.type === "RestElement" ? p.argument : p.left, out);
}

/**
 * The values each local is given in `program`, by name, at the binding's offset: declaration initializers and
 * `=`, `||=`, `&&=`, `??=` assignments to a name. With `patterns`, each name a destructuring declaration binds is
 * given the whole initializer.
 */
export function givenValues(
  program: Program,
  patterns: boolean,
): ReadonlyMap<string, readonly { at: number; v: Expression }[]> {
  const values = new Map<string, { at: number; v: Expression }[]>();
  const give = (name: string, at: number, v: Expression): void =>
    void values.set(name, [...(values.get(name) ?? []), { at, v }]);
  new Visitor({
    VariableDeclarator: (n) => {
      if (n.init === null || (!patterns && n.id.type !== "Identifier")) return;
      const out: { name: string; at: number }[] = [];
      names(n.id, out);
      for (const b of out) give(b.name, b.at, n.init);
    },
    AssignmentExpression: (n) => {
      if (n.left.type === "Identifier" && ASSIGN.has(n.operator)) give(n.left.name, n.left.start, n.right);
    },
  }).visit(program);
  return values;
}
