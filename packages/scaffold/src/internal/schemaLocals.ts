import type { Program } from "oxc-parser";
import { resolveImport } from "./resolveImport.ts";

/** Local names that bind the schema `name` declared in `decl` within the file at `path`. */
export function schemaLocals(
  files: ReadonlyMap<string, string>,
  path: string,
  program: Program,
  decl: string,
  name: string,
): Set<string> {
  const out = new Set<string>();
  if (path === decl) out.add(name);
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || resolveImport(files, path, st.source.value) !== decl) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === name) out.add(sp.local.name);
    }
  }
  return out;
}
