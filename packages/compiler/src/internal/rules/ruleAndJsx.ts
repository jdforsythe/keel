import type { Expression } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { diag } from "../diag.ts";

function isJsx(e: Expression): boolean {
  if (e.type === "ParenthesizedExpression") return isJsx(e.expression);
  return e.type === "JSXElement" || e.type === "JSXFragment";
}

/** E1403: `{cond && <jsx/>}`; conditional rendering goes through `<If when>`. */
export function ruleAndJsx(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const l of a.logicals) {
    if (l.operator !== "&&" || !isJsx(l.right)) continue;
    out.push(diag(a, "E1403", l.start, "`a && <jsx/>` renders conditionally; use <If when={a}>", "k.component"));
  }
  return out;
}
