import { type Argument, type Expression, type Program, Visitor } from "oxc-parser";

const bare = (e: Expression): Expression => (e.type === "ParenthesizedExpression" ? bare(e.expression) : e);

/** Whether `e` can be a value other than `undefined`: the leaves of `?:`, `&&`, `||`, `??` and `,`. */
function claims(e: Expression): boolean {
  const b = bare(e);
  if (b.type === "ConditionalExpression") return claims(b.consequent) || claims(b.alternate);
  if (b.type === "LogicalExpression") return b.operator === "&&" ? claims(b.right) : claims(b.left) || claims(b.right);
  if (b.type === "SequenceExpression") {
    const last = b.expressions.at(-1);
    return last !== undefined && claims(last);
  }
  if (b.type === "Identifier") return b.name !== "undefined";
  return !(b.type === "UnaryExpression" && b.operator === "void");
}

/**
 * Whether an `attempt` call's `expect` (its second argument, a function given in place) claims too much (R1017,
 * k.escapes): it can return an error, and it tests the thrown value by no class but `Error` and by no property
 * (`x.p`, `x[k]`, `Reflect.get(x, k)`, `'p' in x`). An `expect` given by name is not read. `program` is the file
 * the call is in.
 */
export function wideExpect(program: Program, expect: Argument | undefined): boolean {
  if (expect === undefined || expect.type === "SpreadElement") return false;
  const fn = bare(expect);
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") return false;
  const [param] = fn.params;
  if (param === undefined || param.type !== "Identifier") return false;
  const x = param.name;
  const isX = (e: Expression | Argument): boolean => e.type !== "SpreadElement" && nameOf(bare(e)) === x;
  const inside = (n: { start: number; end: number }): boolean => n.start >= fn.start && n.end <= fn.end;
  let tested = false;
  let claimed = false;
  const body = fn.body;
  if (body === null) return false;
  if (body.type !== "BlockStatement") claimed = claims(body);
  new Visitor({
    BinaryExpression: (n) => {
      if (!inside(n)) return;
      if (n.operator === "instanceof" && isX(n.left) && !(n.right.type === "Identifier" && n.right.name === "Error"))
        tested = true;
      if (n.operator === "in" && isX(n.right)) tested = true;
    },
    MemberExpression: (n) => {
      if (inside(n) && isX(n.object)) tested = true;
    },
    CallExpression: (n) => {
      const c = n.callee;
      const [a] = n.arguments;
      const reflect =
        c.type === "MemberExpression" &&
        !c.computed &&
        c.object.type === "Identifier" &&
        c.object.name === "Reflect" &&
        c.property.type === "Identifier" &&
        c.property.name === "get";
      if (inside(n) && reflect && a !== undefined && isX(a)) tested = true;
    },
    ReturnStatement: (n) => {
      if (inside(n) && n.argument !== null && claims(n.argument)) claimed = true;
    },
  }).visit(program);
  return claimed && !tested;
}

/** An identifier's name, else `null`. */
function nameOf(e: Expression): string | null {
  return e.type === "Identifier" ? e.name : null;
}
