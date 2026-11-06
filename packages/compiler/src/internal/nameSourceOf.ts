import type { JSXChild, JSXElement } from "oxc-parser";
import type { A11yEntry } from "../types/A11yEntry.ts";
import { attrOf } from "./attrOf.ts";
import { cleanJsxText } from "./cleanJsxText.ts";

const LABELABLE: ReadonlySet<string> = new Set(["input", "select", "textarea", "meter", "progress", "output"]);
/** Roles whose accessible name may come from content (WAI-ARIA "name from: contents"). */
const FROM_CONTENT: ReadonlySet<string> = new Set([
  "button",
  "cell",
  "checkbox",
  "columnheader",
  "heading",
  "link",
  "listitem",
  "menuitem",
  "option",
  "radio",
  "row",
  "rowheader",
  "switch",
  "tab",
  "tooltip",
  "treeitem",
]);

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
 * Where an element's accessible name comes from: `aria-label(ledby)`, `alt`, an associated `<label>`
 * (`labelled` is computed by the caller from ancestors and `for` attributes), or its text content when
 * the role takes its name from content.
 */
export function nameSourceOf(el: JSXElement, tag: string, role: string | null, labelled: boolean): A11yEntry["name"] {
  if (attrOf(el, "aria-label") !== undefined || attrOf(el, "aria-labelledby") !== undefined) return "aria";
  if ((tag === "img" || tag === "area" || tag === "input") && attrOf(el, "alt") !== undefined) return "alt";
  if (LABELABLE.has(tag) && labelled) return "label";
  if (role !== null && FROM_CONTENT.has(role) && hasText(el.children)) return "text";
  return "none";
}
