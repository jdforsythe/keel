import type { Program } from "oxc-parser";

/** Local names of the namespace imports (`import * as x`) of `source`. */
export function namespaceNames(program: Program, source: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const st of program.body)
    if (st.type === "ImportDeclaration" && st.source.value === source)
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") out.add(sp.local.name);
  return out;
}
