import { type Expression, type Program, Visitor } from "oxc-parser";
import type { Hit } from "./Hit.ts";
import { clip } from "./clip.ts";
import { stringOf } from "./stringOf.ts";

const LETTER = /\p{L}/u;
const ATTRS = ["label", "alt"];

/**
 * E2406 hits in a component (`component`) or `routes.ts` file: a JSX text child, a string literal `label` or `alt`, or
 * a string literal a route `title` function returns (its expression body or its own `return`s), each with a letter.
 */
export function copyHits(program: Program, component: boolean): Hit[] {
  const out: Hit[] = [];
  const literal = (e: Expression): void => {
    const s = stringOf(e);
    if (s !== undefined && LETTER.test(s.value))
      out.push({ at: s.at - 1, msg: `literal copy '${clip(s.value.trim())}'; read it from a message set` });
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
