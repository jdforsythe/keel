import { type Expression, type JSXChild, type Program, Visitor } from "oxc-parser";
import type { Hit } from "./Hit.ts";
import { clip } from "./clip.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

const LETTER = /\p{L}/u;
const ATTRS = ["label", "alt"];

/**
 * The expressions `e` can evaluate to: both branches of a conditional, both sides of `||` and `??`, the right side of
 * `&&`, and with `thunks` the expression body of an arrow (a reactive JSX child); else `e` itself.
 */
function branches(e: Expression, thunks: boolean): Expression[] {
  const x = unwrap(e);
  if (x.type === "ConditionalExpression") return [...branches(x.consequent, thunks), ...branches(x.alternate, thunks)];
  if (x.type === "LogicalExpression")
    return x.operator === "&&"
      ? branches(x.right, thunks)
      : [...branches(x.left, thunks), ...branches(x.right, thunks)];
  if (thunks && x.type === "ArrowFunctionExpression" && x.body.type !== "BlockStatement")
    return branches(x.body, thunks);
  return [x];
}

/**
 * E2406 hits in a component (`component`) or `routes.ts` file, each a string literal with a letter: a JSX text child; a
 * JSX expression child; a `label` or `alt` attribute; a route `title` function's expression body or own `return`s.
 * An expression counts through its literal branches (`branches`).
 */
export function copyHits(program: Program, component: boolean): Hit[] {
  const out: Hit[] = [];
  const literal = (e: Expression, thunks = false): void => {
    for (const b of branches(e, thunks)) {
      const s = stringOf(b);
      if (s !== undefined && LETTER.test(s.value))
        out.push({ at: s.at - 1, msg: `literal copy '${clip(s.value.trim())}'; read it from a message set` });
    }
  };
  const children = (cs: readonly JSXChild[]): void => {
    if (!component) return;
    for (const c of cs)
      if (c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression")
        literal(c.expression, true);
  };
  const titles = new Set<number>();
  const fns: number[] = [];
  const enter = (n: { start: number }): void => {
    fns.push(n.start);
  };
  const exit = (): void => {
    fns.pop();
  };
  new Visitor({
    JSXElement: (n) => children(n.children),
    JSXFragment: (n) => children(n.children),
    JSXText: (n) => {
      if (!component || !LETTER.test(n.value)) return;
      const at = n.start + n.value.length - n.value.trimStart().length;
      out.push({ at, msg: `literal copy '${clip(n.value.trim())}'; read it from a message set` });
    },
    JSXAttribute: (n) => {
      if (!component || n.name.type !== "JSXIdentifier" || !ATTRS.includes(n.name.name) || n.value === null) return;
      if (n.value.type === "Literal") literal(n.value);
      else if (n.value.type === "JSXExpressionContainer" && n.value.expression.type !== "JSXEmptyExpression")
        literal(n.value.expression);
    },
    Property: (p) => {
      const named = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : undefined;
      if (component || p.computed || named !== "title") return;
      const f = p.value;
      if (f.type === "ArrowFunctionExpression" && f.body.type !== "BlockStatement") literal(f.body);
      else if (f.type === "ArrowFunctionExpression" || f.type === "FunctionExpression") titles.add(f.start);
    },
    ArrowFunctionExpression: enter,
    "ArrowFunctionExpression:exit": exit,
    FunctionExpression: enter,
    "FunctionExpression:exit": exit,
    FunctionDeclaration: enter,
    "FunctionDeclaration:exit": exit,
    ReturnStatement: (r) => {
      const top = fns[fns.length - 1];
      if (r.argument !== null && top !== undefined && titles.has(top)) literal(r.argument);
    },
  }).visit(program);
  return out;
}
