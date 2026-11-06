import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const isStylesCall = (e: Expression | null | undefined): boolean =>
  e !== null &&
  e !== undefined &&
  e.type === "CallExpression" &&
  e.callee.type === "Identifier" &&
  e.callee.name === "styles";

/** E1803 (k.ui): a `style` attribute, or an exported `styles` (scoped styles stay file-local). */
export const noInlineStyle: RuleDef = {
  code: "E1803",
  message: (f) =>
    str(f.data, "kind") === "attr"
      ? "style attribute; use token style props or styles() classes"
      : "exported styles; scoped styles are file-local, keep them unexported",
  explain: "Styling is token style props or file-local styles() classes; no inline style, no shared style objects.",
  see: "k.ui",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXAttribute: (n) => {
        if (n.name.type === "JSXIdentifier" && n.name.name === "style")
          out.push(findingAt(file, n.start, { kind: "attr" }));
      },
      ExportNamedDeclaration: (n) => {
        const d = n.declaration;
        if (d?.type !== "VariableDeclaration") return;
        for (const v of d.declarations) {
          const named = v.id.type === "Identifier" && v.id.name === "styles";
          if (named || isStylesCall(v.init)) out.push(findingAt(file, v.start, { kind: "export" }));
        }
      },
      ExportDefaultDeclaration: (n) => {
        const d = n.declaration;
        if (d.type === "CallExpression" && isStylesCall(d)) out.push(findingAt(file, n.start, { kind: "export" }));
      },
    }).visit(ast);
    return out;
  },
};
