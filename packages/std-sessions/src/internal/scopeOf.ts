import type { SourceFile } from "@keel/check";
import type { Expression, Program } from "oxc-parser";
import type { SchemaScope } from "./SchemaScope.ts";

/** Collects top-level `const x = <expr>` bindings and named imports of a program. */
export function scopeOf(path: string, program: Program, files: readonly SourceFile[]): SchemaScope {
  const consts = new Map<string, Expression>();
  const imports = new Map<string, { source: string; name: string }>();
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl !== null && decl !== undefined && decl.type === "VariableDeclaration" && decl.kind === "const") {
      for (const d of decl.declarations)
        if (d.id.type === "Identifier" && d.init !== null) consts.set(d.id.name, d.init);
    } else if (st.type === "ImportDeclaration") {
      for (const sp of st.specifiers) {
        if (sp.type !== "ImportSpecifier") continue;
        const name = sp.imported.type === "Identifier" ? sp.imported.name : String(sp.imported.value);
        imports.set(sp.local.name, { source: st.source.value, name });
      }
    }
  }
  return { path, consts, imports, files };
}
