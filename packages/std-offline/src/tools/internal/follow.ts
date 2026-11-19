import { posix } from "node:path";
import type { SourceFile } from "@keel/check";
import { parseSync } from "oxc-parser";
import type { At } from "./At.ts";

const nameOf = (n: unknown): unknown =>
  typeof n === "object" && n !== null && Reflect.get(n, "type") === "Identifier" ? Reflect.get(n, "name") : undefined;

/**
 * Follows an identifier to the `const` it names, in its own file or, through a relative named import, in another
 * project file, at most 8 steps. Returns the node it ends on (the input when it is not an identifier it can follow).
 */
export function follow(at: At, project: readonly SourceFile[], depth = 0): At {
  const name = nameOf(at.node);
  if (name === undefined || depth > 8) return at;
  for (const st of at.ast.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type === "VariableDeclaration")
      for (const d of decl.declarations)
        if (nameOf(d.id) === name) return follow({ ...at, node: d.init }, project, depth + 1);
    if (st.type !== "ImportDeclaration" || !st.source.value.startsWith(".")) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier" || sp.local.name !== name) continue;
      const path = posix.join(posix.dirname(at.file.path), st.source.value);
      const file = project.find((f) => f.path === path || f.path.replace(/\.[cm]?[jt]sx?$/, "") === path);
      if (file === undefined) return at;
      const ast = parseSync(file.path, file.source, { sourceType: "module" }).program;
      return follow({ node: sp.imported, file, ast }, project, depth + 1);
    }
  }
  return at;
}
