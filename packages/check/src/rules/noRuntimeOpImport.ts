import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const OPS = /^@keel\/runtime-dom\/ops(?:\/|$)/;

/**
 * E1251 (k.runtime): app code imports a runtime op: a static import, re-export, or dynamic `import()` of
 * `@keel/runtime-dom/ops` (compiler output and the generated entry only). No fix: the JSX that replaces an op
 * is the author's.
 */
export const noRuntimeOpImport: RuleDef = {
  code: "E1251",
  message: "app code imports @keel/runtime-dom/ops; use JSX and If/For/Match from @keel/runtime-dom",
  explain: "Ops are compiler output. App code writes JSX and the intrinsics If, For, Match, Case, Boundary.",
  see: "k.runtime",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    for (const st of ast.body) {
      const from =
        st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration"
          ? st.source
          : st.type === "ExportNamedDeclaration"
            ? st.source
            : null;
      if (from !== null && OPS.test(from.value)) out.push(findingAt(file, st.start));
    }
    new Visitor({
      ImportExpression: (n) => {
        if (n.source.type === "Literal" && typeof n.source.value === "string" && OPS.test(n.source.value))
          out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
