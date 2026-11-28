import { type Expression, type Program, Visitor } from "oxc-parser";
import { globalRefs } from "../globals/globalRefs.ts";
import { unwrapExpression as unwrap } from "../globals/unwrapExpression.ts";
import type { Analysis } from "./Analysis.ts";
import type { ElementValue } from "./ElementValue.ts";
import type { FnInfo } from "./FnInfo.ts";

/** Calls whose callback's return value becomes the elements of an array. */
const ARRAY_MAPS: ReadonlySet<string> = new Set(["map", "flatMap"]);
/** Function and alias links followed before giving up (recursion resolves to nothing). */
const MAX_DEPTH = 8;

type Return = { readonly start: number; readonly argument: Expression | null };
const memo = new WeakMap<Program, Return[]>();

function returnsOf(program: Program): Return[] {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const out: Return[] = [];
  new Visitor({ ReturnStatement: (n) => void out.push({ start: n.start, argument: n.argument }) }).visit(program);
  memo.set(program, out);
  return out;
}

/**
 * Whether `e`, written as a JSX child, evaluates to elements the lowering cannot bind as text (rfc:0061,
 * backlog 0165), and which kind: `conditional` (a branch of `?:`, `&&`, `||` or `??` is elements), `list` (an
 * array literal or a `map`/`flatMap` callback holding elements), or `other` (a function, a call of a same-file
 * function or of a function expression, or a same-file binding whose value is elements). Names resolve by
 * lexical scope through the rfc:0053 resolver, so a shadowing parameter or another component's local is not it. Literal JSX children
 * and slot calls are inserted as nodes and are not passed here. Null when no element is found.
 */
export function elementValued(a: Analysis, e: Expression): ElementValue | null {
  const x = unwrap(e);
  if (!yields(a, x, 0)) return null;
  if (x.type === "ConditionalExpression" || x.type === "LogicalExpression") return "conditional";
  if (x.type === "ArrayExpression" || mapCallback(x) !== null) return "list";
  return "other";
}

function mapCallback(x: Expression): Expression | null {
  if (x.type !== "CallExpression") return null;
  const c = unwrap(x.callee);
  if (c.type !== "MemberExpression" || c.computed || !ARRAY_MAPS.has(c.property.name)) return null;
  const f = x.arguments[0];
  return f === undefined || f.type === "SpreadElement" ? null : f;
}

/** Whether `e` can evaluate to JSX elements: itself, through a branch, an array element, or a call's return. */
function yields(a: Analysis, e: Expression, depth: number): boolean {
  if (depth > MAX_DEPTH) return false;
  const x = unwrap(e);
  switch (x.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "ConditionalExpression":
      return yields(a, x.consequent, depth) || yields(a, x.alternate, depth);
    case "LogicalExpression":
      // An element is truthy and never nullish: `<b/> && x` is `x`, while `<b/> || x` and `<b/> ?? x` are `<b/>`.
      return (x.operator !== "&&" && yields(a, x.left, depth)) || yields(a, x.right, depth);
    case "ArrayExpression":
      return x.elements.some((el) => el !== null && yields(a, el.type === "SpreadElement" ? el.argument : el, depth));
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return returnsElements(a, x, depth + 1);
    case "Identifier": {
      // Scope-aware (rfc:0061, backlog 0176): the binding this read resolves to, never another of the same name.
      const g = globalRefs(a.program);
      const v = g.initOf(x);
      if (v !== x) return yields(a, v, depth + 1);
      const f = g.functionOf(x.name, x.start);
      return f !== null && returnsElements(a, f, depth + 1);
    }
    case "CallExpression": {
      const cb = mapCallback(x);
      return callable(a, cb ?? x.callee, depth + 1);
    }
    default:
      return false;
  }
}

/**
 * Whether calling `c` returns elements: a function expression, or a name whose binding (by lexical scope,
 * through same-file aliases) is a function declaration or a `const`/never-assigned function value.
 */
function callable(a: Analysis, c: Expression, depth: number): boolean {
  const g = globalRefs(a.program);
  const x = g.initOf(c);
  if (x.type === "ArrowFunctionExpression" || x.type === "FunctionExpression") return returnsElements(a, x, depth);
  if (x.type !== "Identifier") return false;
  const f = g.functionOf(x.name, x.start);
  return f !== null && returnsElements(a, f, depth);
}

/** Whether a function returns elements: its expression body, or a `return` of its own (not a nested function's). */
function returnsElements(a: Analysis, fn: FnInfo["node"], depth: number): boolean {
  if (depth > MAX_DEPTH) return false;
  const body = fn.body;
  if (body === null) return false;
  if (body.type !== "BlockStatement") return yields(a, body, depth);
  const inner = a.functions.filter((g) => g.start > fn.start && g.end <= fn.end);
  for (const r of returnsOf(a.program)) {
    if (r.start < body.start || r.start >= body.end || r.argument === null) continue;
    if (inner.some((g) => r.start >= g.start && r.start < g.end)) continue;
    if (yields(a, r.argument, depth)) return true;
  }
  return false;
}
