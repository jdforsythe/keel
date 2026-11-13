import { type JSXChild, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { jsxLiteral } from "../internal/jsxLiteral.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const FOCUSABLE = new Set(["Button", "Link", "Input", "TextArea", "Select", "Checkbox"]);
const REVERSED: Readonly<Record<string, string>> = { "row-reverse": "row", "column-reverse": "column" };

/** The focusable base elements written under `kids`, at any JSX depth. */
function focusable(kids: readonly JSXChild[]): number {
  let n = 0;
  for (const k of kids) {
    if (k.type === "JSXFragment") n += focusable(k.children);
    if (k.type !== "JSXElement") continue;
    const name = k.openingElement.name;
    if (name.type === "JSXIdentifier" && FOCUSABLE.has(name.name)) n++;
    n += focusable(k.children);
  }
  return n;
}

/**
 * E1820 (k.a11y): `direction` `row-reverse` or `column-reverse` on an element with two or more focusable base
 * elements under it in its component: the visual order then runs against the focus order. At `direction`; the fix
 * writes the plain direction and reverses the element's children, keeping the text between them.
 */
export const reversedFocusOrder: RuleDef = {
  code: "E1820",
  message: (f) => `direction "${str(f.data, "dir")}" over focusable elements reverses the focus order`,
  explain: "Focus follows document order; a reversed direction shows it backwards.",
  see: "k.a11y",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXElement: (n) => {
        const dir = jsxLiteral(n.openingElement.attributes, "direction");
        const plain = dir ? REVERSED[dir.text] : undefined;
        if (!dir || plain === undefined || focusable(n.children) < 2) return;
        const kids = n.children.filter((k) => k.type !== "JSXText" || k.value.trim() !== "");
        const first = kids[0];
        const last = kids[kids.length - 1];
        if (first === undefined || last === undefined) return;
        const texts = kids.map((k) => file.source.slice(k.start, k.end));
        const gaps = kids.slice(1).map((k, i) => file.source.slice(kids[i]?.end ?? k.start, k.start));
        const reversed = texts.reverse().reduce((acc, t, i) => (i === 0 ? t : acc + (gaps[i - 1] ?? "") + t), "");
        const data = {
          dir: dir.text,
          plain,
          vs: dir.start,
          ve: dir.end,
          cs: first.start,
          ce: last.end,
          kids: reversed,
        };
        out.push(findingAt(file, dir.start, data));
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => [
    { start: num(f.data, "vs"), end: num(f.data, "ve"), text: `"${str(f.data, "plain")}"` },
    { start: num(f.data, "cs"), end: num(f.data, "ce"), text: str(f.data, "kids") },
  ],
};
