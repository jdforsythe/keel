import type { SourceFile } from "@keel/check";
import type { Program } from "oxc-parser";
import { joinPath } from "./joinPath.ts";
import { kindAt } from "./kindAt.ts";
import { parsed } from "./parsed.ts";

/** The values of `const <name> = s.enum([...])` declared (or exported) in `program`. */
function enumIn(program: Program, name: string): readonly string[] | undefined {
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || d.id.name !== name || d.init === null) continue;
      const kind = kindAt(d.init);
      return typeof kind === "object" ? kind : undefined;
    }
  }
  return undefined;
}

/**
 * The locale tags of a set's `locales` identifier: an `s.enum([...])` literal in the schema file itself, or exported
 * by the relative module it is imported from; `undefined` when not read statically.
 */
export function localesOf(
  name: string,
  file: SourceFile,
  program: Program,
  project: readonly SourceFile[],
): readonly string[] | undefined {
  const own = enumIn(program, name);
  if (own !== undefined) return own;
  const dir = file.path.slice(0, file.path.lastIndexOf("/") + 1);
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || !st.source.value.startsWith(".")) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier" || sp.local.name !== name) continue;
      const target = project.find((f) => f.path === joinPath(dir, st.source.value));
      const ast = target === undefined ? undefined : parsed(target);
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      return ast === undefined ? undefined : enumIn(ast, imported);
    }
  }
  return undefined;
}
