import { clipMessage } from "@keel/schema/internal";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { schemesIn } from "../internal/schemesIn.ts";
import { str } from "../internal/str.ts";
import { uiElementSites } from "../internal/uiElementSites.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1814 (k.schemes Checks): a `SchemeSelect` of `@keel/ui` in an app or library file, in a project whose tokens have
 * one scheme (`schemesIn`; a project with no `tokens.ts` has `light` alone), at the element or call. With the type pass
 * on, the sites are the ones the checker resolves to it (`schemeSelects`: imports, re-exports, namespace members);
 * without it, the ones `uiElementSites` finds. A `Box` of `@keel/ui` writing `scheme` with a string is the same
 * finding at the attribute, its message naming the value. A project whose `tokens.ts` gave no tokens judges none.
 */
export const schemeSelectOneScheme: RuleDef = {
  code: "E1814",
  message: (f) =>
    str(f.data, "value") === ""
      ? `SchemeSelect needs schemes light and dark; the tokens have ${str(f.data, "scheme")} only`
      : `scheme="${clipMessage(str(f.data, "value"), 20)}" needs schemes light and dark; the tokens have ${str(f.data, "scheme")} only`,
  see: "k.schemes",
  check: ({ file, ast, artifacts, project, schemeSelects }) => {
    if (!isAppPath(file.path)) return [];
    const hasFile = project.some(
      (f) => /(?:^|\/)tokens\.ts$/.test(f.path) && !/(?:^|\/)(?:modules|node_modules)\//.test(f.path),
    );
    if (artifacts.tokens === undefined && hasFile) return [];
    const schemes = artifacts.tokens === undefined ? ["light"] : schemesIn(artifacts.tokens);
    if (schemes.length !== 1) return [];
    const scheme = schemes[0] ?? "light";
    const out: Finding[] = [];
    const sites =
      schemeSelects !== undefined
        ? [...schemeSelects].sort((x, y) => x - y)
        : uiElementSites(file, ast, project, "SchemeSelect").map((s) => s.at);
    for (const at of sites) out.push(findingAt(file, at, { scheme }));
    for (const site of uiElementSites(file, ast, project, "Box")) {
      const attr = site.element?.attributes.find(
        (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "scheme",
      );
      if (attr?.type !== "JSXAttribute") continue;
      const v = attr.value;
      const lit = v?.type === "JSXExpressionContainer" ? v.expression : v;
      if (lit?.type !== "Literal" || typeof lit.value !== "string") continue;
      out.push(findingAt(file, attr.start, { scheme, value: lit.value }));
    }
    return out.sort((x, y) => x.line - y.line || x.col - y.col);
  },
};
