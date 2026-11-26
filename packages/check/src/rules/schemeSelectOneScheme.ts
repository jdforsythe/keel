import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { schemesIn } from "../internal/schemesIn.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1814 (k.schemes Checks): a `SchemeSelect` of `@keel/ui` in an app or library file, in a project whose tokens have
 * one scheme (`schemesIn`; a project with no `tokens.ts` has `light` alone), at the element or call. With the type pass
 * on, the sites are the ones the checker resolves to it (`schemeSelects`: imports, re-exports, namespace members);
 * without it, JSX of a name imported from `@keel/ui`. A project whose `tokens.ts` gave no tokens judges none.
 */
export const schemeSelectOneScheme: RuleDef = {
  code: "E1814",
  message: (f) => `SchemeSelect needs schemes light and dark; the tokens have ${str(f.data, "scheme")} only`,
  see: "k.schemes",
  check: ({ file, ast, artifacts, project, schemeSelects }) => {
    if (!isAppPath(file.path)) return [];
    const hasFile = project.some(
      (f) => /(?:^|\/)tokens\.ts$/.test(f.path) && !/(?:^|\/)(?:modules|node_modules)\//.test(f.path),
    );
    if (artifacts.tokens === undefined && hasFile) return [];
    const schemes = artifacts.tokens === undefined ? ["light"] : schemesIn(artifacts.tokens);
    if (schemes.length !== 1) return [];
    const data = { scheme: schemes[0] ?? "light" };
    if (schemeSelects !== undefined)
      return [...schemeSelects].sort((x, y) => x - y).map((at) => findingAt(file, at, data));
    const locals = new Set<string>();
    for (const st of ast.body)
      if (st.type === "ImportDeclaration" && st.source.value === "@keel/ui")
        for (const sp of st.specifiers)
          if (sp.type === "ImportSpecifier" && sp.imported.type === "Identifier" && sp.imported.name === "SchemeSelect")
            locals.add(sp.local.name);
    if (locals.size === 0) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXOpeningElement: (n) => {
        if (n.name.type === "JSXIdentifier" && locals.has(n.name.name)) out.push(findingAt(file, n.start, data));
      },
    }).visit(ast);
    return out;
  },
};
