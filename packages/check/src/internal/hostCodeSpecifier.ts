import type { ArrowFunctionExpression, Expression } from "oxc-parser";

const unwrap = (e: Expression): Expression => (e.type === "ParenthesizedExpression" ? unwrap(e.expression) : e);

/** The expression an arrow function without a block returns, else null. */
const returned = (f: ArrowFunctionExpression): Expression | null =>
  f.body.type === "BlockStatement" ? null : unwrap(f.body);

/** A string literal's value, or a template literal's with no substitutions; else null. */
function text(e: Expression): string | null {
  if (e.type === "Literal") return typeof e.value === "string" ? e.value : null;
  if (e.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? null;
  return null;
}

/**
 * The relative specifier of a `Host`'s `code` when it has the one form k.host-element allows,
 * `() => import("<relative path>").then((m) => m.<export>)`, else null (E1824).
 */
export function hostCodeSpecifier(code: Expression | null): string | null {
  if (code === null) return null;
  const f = unwrap(code);
  if (f.type !== "ArrowFunctionExpression" || f.async || f.params.length > 0) return null;
  const call = returned(f);
  if (call?.type !== "CallExpression" || call.arguments.length !== 1) return null;
  const then = call.callee;
  if (then.type !== "MemberExpression" || then.computed || then.property.type !== "Identifier") return null;
  if (then.property.name !== "then" || then.optional) return null;
  const imp = unwrap(then.object);
  if (imp.type !== "ImportExpression" || imp.options !== null) return null;
  const spec = text(imp.source);
  if (spec === null || !(spec.startsWith("./") || spec.startsWith("../"))) return null;
  const pick = call.arguments[0];
  if (pick === undefined || pick.type === "SpreadElement") return null;
  const m = unwrap(pick);
  if (m.type !== "ArrowFunctionExpression" || m.async || m.params.length !== 1) return null;
  const param = m.params[0];
  if (param?.type !== "Identifier") return null;
  const pickBody = returned(m);
  if (pickBody?.type !== "MemberExpression" || pickBody.computed || pickBody.optional) return null;
  const obj = pickBody.object;
  return obj.type === "Identifier" && obj.name === param.name && pickBody.property.type === "Identifier" ? spec : null;
}
