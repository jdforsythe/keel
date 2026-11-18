import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { urlText } from "../internal/urlText.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const ATTRS = new Set(["src", "poster", "data", "srcset", "action", "formaction"]);
const ABSOLUTE = /^\s*(?:https?:)?\/\//i;

/**
 * E1570 (k.security): an absolute http(s) or protocol-relative URL in a JSX `src`, `poster`, `data`, `srcset` (any
 * candidate), `action` or `formaction`, `Image src` included, read as `urlText` reads it (a literal, a const, a
 * template or `+` head, `new URL`): the policy loads only this origin. At the value; no fix.
 */
export const foreignUrlAttr: RuleDef = {
  code: "E1570",
  message: "absolute URL in a resource attribute; the content security policy blocks other origins",
  see: "k.security",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXAttribute: (a) => {
        const v = a.value;
        if (a.name.type !== "JSXIdentifier" || !ATTRS.has(a.name.name) || v === null) return;
        const text =
          v.type === "Literal"
            ? v.value
            : v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
              ? urlText(v.expression, file, project)
              : null;
        if (typeof text !== "string") return;
        const urls = a.name.name === "srcset" ? text.split(",") : [text];
        if (urls.some((u) => ABSOLUTE.test(u))) out.push(findingAt(file, v.start));
      },
    }).visit(ast);
    return out;
  },
};
