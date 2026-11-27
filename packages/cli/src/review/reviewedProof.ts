import type { ArrowFunctionExpression, Expression, Function as FunctionNode, Statement } from "oxc-parser";

/** The kernel guards (k.identity Identity). */
const KERNEL_GUARDS: ReadonlySet<string> = new Set([
  "isSchema",
  "isObjectSchema",
  "isDefect",
  "isStore",
  "isTransaction",
  "isRouteTable",
]);

const bare = (e: Expression): Expression => (e.type === "ParenthesizedExpression" ? bare(e.expression) : e);

/** The operands of an `&&` chain, parentheses aside. */
function ands(e: Expression): Expression[] {
  const b = bare(e);
  return b.type === "LogicalExpression" && b.operator === "&&" ? [...ands(b.left), ...ands(b.right)] : [b];
}

/** Whether `s` is a call of `defect`, as a statement or a block holding only it. */
function isDefectStatement(s: Statement): boolean {
  if (s.type === "BlockStatement") {
    const [only] = s.body;
    return s.body.length === 1 && only !== undefined && isDefectStatement(only);
  }
  if (s.type !== "ExpressionStatement") return false;
  const c = bare(s.expression);
  return c.type === "CallExpression" && c.callee.type === "Identifier" && c.callee.name === "defect";
}

/** The `P` of a predicate's body (k.identity): an arrow's expression, `return P`, or `if (!(P)) defect(...)`. */
function proofOf(n: FunctionNode | ArrowFunctionExpression, asserts: boolean): Expression | null {
  const body = n.body;
  if (body === null) return null;
  if (body.type !== "BlockStatement") return asserts ? null : body;
  const [only] = body.body;
  if (body.body.length !== 1 || only === undefined) return null;
  if (!asserts) return only.type === "ReturnStatement" ? only.argument : null;
  if (only.type !== "IfStatement" || only.alternate !== null || !isDefectStatement(only.consequent)) return null;
  const t = bare(only.test);
  return t.type === "UnaryExpression" && t.operator === "!" ? t.argument : null;
}

/**
 * Whether `keel review` lists a type predicate or assertion as R1015 (k.identity): every one but those whose body
 * holds, as a conjunct on the subject itself, a kernel guard's call, an `instanceof` (a class) or `S.parse(x).ok` (a
 * schema). A body proven by structure or by its module's own set is listed for a person to read.
 */
export function reviewedProof(n: FunctionNode | ArrowFunctionExpression): boolean {
  const pred = n.returnType?.typeAnnotation;
  if (pred?.type !== "TSTypePredicate") return false;
  const name = pred.parameterName.type === "Identifier" ? pred.parameterName.name : null;
  const p = proofOf(n, pred.asserts);
  if (p === null || name === null) return true;
  const subject = (e: Expression | undefined): boolean => {
    const b = e === undefined ? undefined : bare(e);
    return b?.type === "Identifier" && b.name === name;
  };
  const strong = ands(p).some((c) => {
    if (c.type === "BinaryExpression" && c.operator === "instanceof") return subject(c.left);
    if (c.type === "CallExpression" && c.callee.type === "Identifier" && KERNEL_GUARDS.has(c.callee.name))
      return c.arguments[0] !== undefined && c.arguments[0].type !== "SpreadElement" && subject(c.arguments[0]);
    if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier" || c.property.name !== "ok")
      return false;
    const call = bare(c.object);
    if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression") return false;
    const callee = call.callee;
    const [arg] = call.arguments;
    return (
      !callee.computed &&
      callee.property.type === "Identifier" &&
      callee.property.name === "parse" &&
      arg !== undefined &&
      arg.type !== "SpreadElement" &&
      subject(arg)
    );
  });
  return !strong;
}
