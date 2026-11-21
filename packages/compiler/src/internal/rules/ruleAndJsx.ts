import type { Expression, JSXChild, JSXElement, JSXExpressionContainer, JSXFragment } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import type { ElementValue } from "../ElementValue.ts";
import { RAW_TEXT_TAGS } from "../RAW_TEXT_TAGS.ts";
import type { Span } from "../Span.ts";
import { cleanJsxText } from "../cleanJsxText.ts";
import { diag } from "../diag.ts";
import { elementValued } from "../elementValued.ts";
import { intrinsicOf } from "../intrinsicOf.ts";
import { isSlotCall } from "../isSlotCall.ts";
import { tagNameOf } from "../tagNameOf.ts";
import { unifiedPatch } from "../unifiedPatch.ts";

function unparen(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" ? unparen(e.expression) : e;
}

function isJsx(e: Expression): boolean {
  const x = unparen(e);
  return x.type === "JSXElement" || x.type === "JSXFragment";
}

const isEmpty = (e: Expression): boolean => {
  const x = unparen(e);
  return (
    (x.type === "Literal" && (x.value === null || x.value === "")) ||
    (x.type === "Identifier" && x.name === "undefined")
  );
};

const MESSAGES: Readonly<Record<ElementValue, string>> = {
  conditional: "elements in a conditional expression; use <If when={…} fallback={…}>",
  list: "elements in an array or map(); use <For each={…} key>",
  other: "elements from a function, call or binding; write the JSX inline or as a component",
};
const AND_MESSAGE = "`a && <jsx/>` renders conditionally; use <If when={a}>";

/** Children the lowering classifies (`If`/`For`/`Case`/`Boundary` take a lone function child as their render). */
function classified(a: Analysis, parent: JSXElement | JSXFragment): JSXChild[] {
  if (parent.type === "JSXFragment") return parent.children;
  if (RAW_TEXT_TAGS.has(tagNameOf(parent.openingElement.name))) return [];
  const kind = intrinsicOf(a, parent);
  if (kind === "Match") return [];
  if (kind === undefined) return parent.children;
  const real = parent.children.filter((c) => c.type !== "JSXText" || cleanJsxText(c.value) !== "");
  const only = real[0];
  if (real.length !== 1 || only === undefined || only.type !== "JSXExpressionContainer") return parent.children;
  const e = only.expression.type === "JSXEmptyExpression" ? undefined : unparen(only.expression);
  return e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression")
    ? []
    : parent.children;
}

/** The `<If>` rewrite of `{c && <x/>}` or `{c ? <x/> : <y/>}` (either branch may be empty), else null. */
function ifFix(a: Analysis, c: JSXExpressionContainer, e: Expression): string | null {
  const text = (s: Span): string => a.source.slice(s.start, s.end);
  let when: string;
  let then: Expression;
  let otherwise: Expression | null = null;
  if (e.type === "LogicalExpression" && e.operator === "&&" && isJsx(e.right)) {
    when = text(e.left);
    then = e.right;
  } else if (e.type === "ConditionalExpression") {
    const yes = isJsx(e.consequent);
    const no = isJsx(e.alternate);
    if (yes && (no || isEmpty(e.alternate))) {
      when = text(e.test);
      then = e.consequent;
      otherwise = no ? e.alternate : null;
    } else if (no && isEmpty(e.consequent)) {
      when = `!(${text(e.test)})`;
      then = e.alternate;
    } else return null;
  } else return null;
  let name: string | undefined;
  for (const [local, kind] of a.intrinsics) if (kind === "If") name = local;
  // Without `If` in scope the fix would also add an import: a second hunk that puts the compact output of
  // ten E1403s over the docs/OUTPUT.md budget, so there is no fix (rfc:0061).
  if (name === undefined) return null;
  const fallback = otherwise === null ? "" : ` fallback={() => ${text(unparen(otherwise))}}`;
  const body = `<${name} when={${when}}${fallback}>${text(unparen(then))}</${name}>`;
  return unifiedPatch(a.path, a.source, [{ start: c.start, end: c.end, text: body }]);
}

/**
 * E1403 (k.component, rfc:0061): elements in a JSX child expression. Conditional rendering goes through `<If>`,
 * lists through `<For>`, so a child `{a && <b/>}`, `{a ? <b/> : <i/>}` (also `||`, `??`), an array or `map()`
 * of elements, a function child, a call of a same-file function returning elements, or a same-file binding
 * holding them is reported, and the lowering binds nothing for it (never a text binding of a node). `&&` with
 * a JSX right operand is reported anywhere. The fix rewrites `&&` and `?:` children with element or empty
 * branches to `<If when fallback>` when the file imports `If`.
 */
export function ruleAndJsx(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const covered: Span[] = [];
  for (const j of a.jsx) {
    for (const c of classified(a, j)) {
      if (c.type !== "JSXExpressionContainer" || c.expression.type === "JSXEmptyExpression") continue;
      const e = unparen(c.expression);
      if (e.type === "Literal" || e.type === "JSXElement" || e.type === "JSXFragment" || isSlotCall(e)) continue;
      const kind = elementValued(a, c.expression);
      if (kind === null) continue;
      covered.push({ start: c.start, end: c.end });
      const and = e.type === "LogicalExpression" && e.operator === "&&" && isJsx(e.right);
      const fix = ifFix(a, c, e) ?? undefined;
      out.push(diag(a, "E1403", e.start, and ? AND_MESSAGE : MESSAGES[kind], "k.component", fix));
    }
  }
  for (const l of a.logicals) {
    if (l.operator !== "&&" || !isJsx(l.right)) continue;
    if (covered.some((s) => l.start >= s.start && l.end <= s.end)) continue;
    out.push(diag(a, "E1403", l.start, AND_MESSAGE, "k.component"));
  }
  return out.sort((x, y) => x.line - y.line || x.col - y.col);
}
