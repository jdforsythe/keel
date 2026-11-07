import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** E1803 (k.ui): a `style` attribute. */
export const noInlineStyle: RuleDef = {
  code: "E1803",
  message: () => "style attribute; use token style props",
  explain: "Styling is token style props; no inline style.",
  see: "k.ui",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXAttribute: (n) => {
        if (n.name.type === "JSXIdentifier" && n.name.name === "style") out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
