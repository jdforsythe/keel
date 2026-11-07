import type { JSXChild, JSXElement } from "oxc-parser";
import { LABELABLE } from "../a11y/LABELABLE.ts";
import { NAME_FROM_CONTENT } from "../a11y/NAME_FROM_CONTENT.ts";
import type { A11yEntry } from "../types/A11yEntry.ts";
import { attrOf } from "./attrOf.ts";
import { cleanJsxText } from "./cleanJsxText.ts";
import { jsxAttrs } from "./jsxAttrs.ts";

function hasText(children: JSXChild[]): boolean {
  return children.some((c) => {
    if (c.type === "JSXText") return cleanJsxText(c.value) !== "";
    if (c.type === "JSXExpressionContainer") {
      const t = c.expression.type;
      return (
        t !== "JSXEmptyExpression" &&
        t !== "JSXElement" &&
        t !== "ArrowFunctionExpression" &&
        t !== "FunctionExpression"
      );
    }
    if (c.type === "JSXElement" || c.type === "JSXFragment") return hasText(c.children);
    return false;
  });
}

/**
 * Where an element's accessible name comes from, in the harness's order (`@keel/testing` applies the same
 * tables to the DOM): none for `presentation`/`none`; `aria-label(ledby)`; an associated `<label>` of a form
 * control (`labelled` is computed by the caller from ancestors and `for` attributes); a non-empty `alt` of
 * `img`, `area`, or `input type="image"`; text content when the role takes its name from content.
 */
export function nameSourceOf(el: JSXElement, tag: string, role: string | null, labelled: boolean): A11yEntry["name"] {
  if (role === "presentation" || role === "none") return "none";
  if (attrOf(el, "aria-label") !== undefined || attrOf(el, "aria-labelledby") !== undefined) return "aria";
  const control = LABELABLE.has(tag);
  if (control && labelled) return "label";
  const attr = jsxAttrs(el);
  const alt = attr("alt");
  const image = tag === "img" || tag === "area" || (tag === "input" && attr("type")?.toLowerCase() === "image");
  if (image && alt !== null && alt !== "") return "alt";
  if (!control && role !== null && NAME_FROM_CONTENT.has(role) && hasText(el.children)) return "text";
  return "none";
}
