import type { Program } from "oxc-parser";

/** Local names under which `exported` is imported from `source` (value or type imports). */
export function localNames(program: Program, exported: string, source: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== source) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === exported) out.add(sp.local.name);
    }
  }
  return out;
}
