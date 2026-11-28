import type { Expression } from "oxc-parser";
import type { Narrowing } from "./Narrowing.ts";

/** What a condition's value says of a `Result` (R1013): `whenTrue`, that one is not ok when it is true; `whenFalse`, when it is false. */

const NONE: Narrowing = { whenTrue: false, whenFalse: false };

/** An expression with its parentheses, `!` assertions and optional chain taken off. */
function bare(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression" || e.type === "TSNonNullExpression" || e.type === "ChainExpression")
    return bare(e.expression);
  return e;
}

/** Whether `e` is `X.ok`, `X` a name, member or call. */
function isOk(e: Expression): boolean {
  const m = bare(e);
  if (m.type !== "MemberExpression" || m.computed || m.property.type !== "Identifier" || m.property.name !== "ok")
    return false;
  const o = bare(m.object);
  return o.type === "Identifier" || o.type === "MemberExpression" || o.type === "CallExpression";
}

/** The boolean a literal `true` or `false` holds, else null. */
function booleanOf(e: Expression): boolean | null {
  const b = bare(e);
  return b.type === "Literal" && typeof b.value === "boolean" ? b.value : null;
}

/**
 * What a condition says of a `Result`, read as TypeScript narrows `ok` without types: `X.ok`, `!`, `===` and `!==`
 * against a boolean (either side), `&&` (true when either side's truth says so) and `||` (false when either side's
 * falsity says so).
 */
export function okFacts(e: Expression): Narrowing {
  const c = bare(e);
  if (isOk(c)) return { whenTrue: false, whenFalse: true };
  if (c.type === "UnaryExpression" && c.operator === "!") {
    const f = okFacts(c.argument);
    return { whenTrue: f.whenFalse, whenFalse: f.whenTrue };
  }
  if (c.type === "BinaryExpression" && (c.operator === "===" || c.operator === "!==")) {
    const value = isOk(c.left) ? booleanOf(c.right) : isOk(c.right) ? booleanOf(c.left) : null;
    if (value === null) return NONE;
    // `X.ok === true` is true when ok; `!==`, or a comparison with `false`, turns it over.
    const trueWhenOk = value === (c.operator === "===");
    return { whenTrue: !trueWhenOk, whenFalse: trueWhenOk };
  }
  if (c.type === "LogicalExpression" && c.operator === "&&") {
    const l = okFacts(c.left);
    const r = okFacts(c.right);
    return { whenTrue: l.whenTrue || r.whenTrue, whenFalse: false };
  }
  if (c.type === "LogicalExpression" && c.operator === "||") {
    const l = okFacts(c.left);
    const r = okFacts(c.right);
    return { whenTrue: false, whenFalse: l.whenFalse || r.whenFalse };
  }
  return NONE;
}
