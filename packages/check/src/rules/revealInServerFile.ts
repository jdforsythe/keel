import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1105 (k.privacy): `reveal` from `@keel/schema` in an app file other than `*.server.ts`, tests included: a named import
 * (`reveal`, `reveal as x`) or a `<namespace>.reveal` use of a namespace import. Reported at the specifier
 * or member; no fix (moving code is not a one-hunk edit).
 */
export const revealInServerFile: RuleDef = {
  code: "E1105",
  message: () => "`reveal` in client code; move to a *.server.ts file",
  see: "k.privacy",
  check: ({ file, ast }) => {
    if (!(isAppPath(file.path) || isTestPath(file.path)) || /\.server\.[cm]?[jt]s$/.test(file.path)) return [];
    const out: Finding[] = [];
    const namespaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
      for (const sp of st.specifiers) {
        if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
        else if (sp.type === "ImportSpecifier") {
          const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
          if (imported === "reveal") out.push(findingAt(file, sp.start));
        }
      }
    }
    if (namespaces.size === 0) return out;
    new Visitor({
      MemberExpression: (n) => {
        if (n.computed || n.object.type !== "Identifier" || !namespaces.has(n.object.name)) return;
        if (n.property.type === "Identifier" && n.property.name === "reveal") out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
