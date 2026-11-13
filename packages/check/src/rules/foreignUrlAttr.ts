import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { jsxLiteral } from "../internal/jsxLiteral.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const ATTRS = ["src", "poster", "data", "srcset", "action", "formaction"];
const ABSOLUTE = /^\s*https?:\/\//i;

/**
 * E1570 (k.security): a literal absolute http(s) URL in a JSX `src`, `poster`, `data`, `srcset` (any candidate),
 * `action` or `formaction`, `Image src` included: the policy loads only this origin. At the value; no fix.
 */
export const foreignUrlAttr: RuleDef = {
  code: "E1570",
  message: "absolute URL in a resource attribute; the content security policy blocks other origins",
  explain: "The document's policy loads images, media and form targets from this origin only.",
  see: "k.security",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXOpeningElement: (n) => {
        for (const name of ATTRS) {
          const v = jsxLiteral(n.attributes, name);
          if (!v) continue;
          const urls = name === "srcset" ? v.text.split(",") : [v.text];
          if (urls.some((u) => ABSOLUTE.test(u))) out.push(findingAt(file, v.start));
        }
      },
    }).visit(ast);
    return out;
  },
};
