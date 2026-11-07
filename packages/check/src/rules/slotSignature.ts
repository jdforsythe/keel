import { type JSXAttribute, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Standard slot (k.ui) -> its signature and the most parameters a function value may take. */
const SLOTS: ReadonlyMap<string, readonly [string, number]> = new Map([
  ["loading", ["() => JSX", 0]],
  ["empty", ["() => JSX", 0]],
  ["error", ["(e: KeelError) => JSX", 1]],
]);

/**
 * `null` when `a`'s value fits (or is not visible statically); otherwise the offset to insert `() => ` at when
 * that repairs it (a JSX element), or -1.
 */
function mismatch(a: JSXAttribute, max: number): number | null {
  const v = a.value;
  if (v === null || v.type === "Literal") return -1;
  if (v.type !== "JSXExpressionContainer") return null;
  const e = v.expression;
  if (e.type === "JSXElement" || e.type === "JSXFragment") return e.start;
  if (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression") return e.params.length > max ? -1 : null;
  const literal =
    e.type === "Literal" ||
    e.type === "TemplateLiteral" ||
    e.type === "ObjectExpression" ||
    e.type === "ArrayExpression";
  return literal ? -1 : null;
}

/**
 * E1806 (k.ui): a JSX attribute named for a standard slot (`loading`, `empty`, `error`) whose value is visibly not
 * that signature: a string, a bare attribute, a literal, a JSX element, or a function with too many parameters.
 * Identifiers and calls are left to the type checker. Fix (a JSX element only): wrap it as `() => <El />`.
 */
export const slotSignature: RuleDef = {
  code: "E1806",
  message: (f) => `slot ${str(f.data, "slot")} must be ${str(f.data, "sig")}`,
  explain: "loading, empty, and error are standard slots everywhere: () => JSX, () => JSX, (e: KeelError) => JSX.",
  see: "k.ui",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || !/x$/.test(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXAttribute: (n) => {
        if (n.name.type !== "JSXIdentifier") return;
        const slot = SLOTS.get(n.name.name);
        if (slot === undefined) return;
        const m = mismatch(n, slot[1]);
        if (m === null) return;
        const data = { slot: n.name.name, sig: slot[0] };
        out.push(findingAt(file, n.start, { ...data, wrap: m }));
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const at = num(f.data, "wrap");
    return at < 0 ? null : [{ start: at, end: at, text: "() => " }];
  },
};
