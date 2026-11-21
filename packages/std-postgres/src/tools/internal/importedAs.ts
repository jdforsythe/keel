import type { RuleInput } from "@keel/check";

/** The local names a file binds `name` of module `from` to by value imports (`import { database as db } ...`). */
export function importedAs(ast: RuleInput["ast"], from: string, name: string): Set<string> {
  const out = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type" || st.source.value !== from) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === name) out.add(sp.local.name);
    }
  }
  return out;
}
