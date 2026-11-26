import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** A defect's code as k.errors names it: `E` and four digits. */
const CODE = /^E\d{4}$/;

/**
 * E1455 (k.errors): a call of `defect` from `@keel/schema` (any alias, or `<namespace>.defect`) whose second argument
 * is not a string literal of `E` and four digits, at that argument. A `defect` the file declares itself, or one
 * shadowing the import, is not this rule's. No fix: the code is a stable name the author writes. These spellings are
 * read without the type pass; with it, `calleeUses` finds `defect` by its symbol (k.unsafe One path).
 */
export const defectCode: RuleDef = {
  code: "E1455",
  message: () => "defect code is not a literal E and four digits",
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (types === true || !isAppPath(file.path)) return [];
    const names = localNames(ast, "defect", "@keel/schema");
    const namespaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
    }
    if (names.size === 0 && namespaces.size === 0) return [];
    const g = globalRefs(ast);
    const bound = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const isDefect =
          c.type === "Identifier"
            ? names.has(c.name) && bound(c.name, c.start)
            : c.type === "MemberExpression" &&
              !c.computed &&
              c.object.type === "Identifier" &&
              namespaces.has(c.object.name) &&
              bound(c.object.name, c.object.start) &&
              c.property.name === "defect";
        const code = n.arguments[1];
        if (!isDefect || code === undefined) return;
        if (code.type === "Literal" && typeof code.value === "string" && CODE.test(code.value)) return;
        out.push(findingAt(file, code.start));
      },
    }).visit(ast);
    return out;
  },
};
