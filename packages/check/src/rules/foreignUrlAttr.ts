import type { Origins } from "@keel/compiler";
import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isDeclaredUrl } from "../internal/isDeclaredUrl.ts";
import { urlText } from "../internal/urlText.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const ATTRS = new Set(["src", "poster", "data", "srcset", "action", "formaction"]);
/** An absolute URL as a browser reads it: a backslash counts as `/` in an http(s) URL, so `/\host` and `\\host` are `//host`. */
const ABSOLUTE = /^\s*(?:https?:)?[\\/]{2}/i;
/** `<element> <attribute>` -> the directive whose declared origins admit it (k.origins Rules); `poster` is `img`. */
const DIRECTIVE: Readonly<Record<string, keyof Origins>> = {
  "Image src": "img",
  "img src": "img",
  "img srcset": "img",
  "source srcset": "img",
  "video src": "media",
  "audio src": "media",
  "source src": "media",
  "track src": "media",
  "Frame src": "frame",
  "iframe src": "frame",
};

/**
 * E1570 (k.security, k.origins): an absolute http(s) or protocol-relative URL in a JSX `src`, `poster`, `data`,
 * `srcset` (any candidate), `action` or `formaction`, `Image src` and `Frame src` (by name) included, read as `urlText` reads it
 * (a literal, a const, a template or `+` head, `new URL`), unless its origin is declared under the attribute's
 * directive on each deployable that serves the file (`isDeclaredUrl`; a `srcset` when every absolute candidate's
 * is); and a `Frame src` whose known text is not absolute, since the policy has no same-origin frame. At the value; no fix.
 */
export const foreignUrlAttr: RuleDef = {
  code: "E1570",
  message: "absolute URL in a resource attribute; the content security policy blocks other origins",
  see: "k.security",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXOpeningElement: (o) => {
        const tag = o.name.type === "JSXIdentifier" ? o.name.name : "";
        for (const a of o.attributes) {
          const v = a.type === "JSXAttribute" ? a.value : null;
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || !ATTRS.has(a.name.name) || v === null)
            continue;
          const text =
            v.type === "Literal"
              ? v.value
              : v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
                ? urlText(v.expression, file, project)
                : null;
          if (typeof text !== "string") continue;
          const directive = a.name.name === "poster" ? "img" : DIRECTIVE[`${tag} ${a.name.name}`];
          const urls = (a.name.name === "srcset" ? text.split(",") : [text]).filter((u) => ABSOLUTE.test(u));
          const relativeFrame = tag === "Frame" && a.name.name === "src" && !ABSOLUTE.test(text);
          if (
            relativeFrame ||
            !urls.every((u) => isDeclaredUrl(file.path, project, directive, u, v.type === "Literal"))
          )
            out.push(findingAt(file, v.start));
        }
      },
    }).visit(ast);
    return out;
  },
};
