import type { Expression, Program } from "oxc-parser";
import type { SchemaSource } from "./SchemaSource.ts";
import { localNames } from "./modules/localNames.ts";

/** The schema-resolution view of `program` at `path`: `s` aliases, top-level consts, named imports. */
export function schemaSourceOf(path: string, program: Program): SchemaSource {
  const consts = new Map<string, Expression>();
  const imports = new Map<string, { source: string; name: string }>();
  for (const st of program.body) {
    if (st.type === "ImportDeclaration") {
      for (const sp of st.specifiers) {
        if (sp.type !== "ImportSpecifier") continue;
        const name = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
        imports.set(sp.local.name, { source: st.source.value, name });
      }
      continue;
    }
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.init !== null && d.init !== undefined) consts.set(d.id.name, d.init);
  }
  return { path, s: localNames(program, "s", "@keel/schema"), consts, imports };
}
