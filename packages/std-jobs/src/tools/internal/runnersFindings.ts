import type { Finding, SourceFile } from "@keel/check";
import type { Program } from "oxc-parser";
import { lineCol } from "./lineCol.ts";
import { moduleFile } from "./moduleFile.ts";

/**
 * In a module holding `modules/<id>/<name>.server.ts`: a finding on its `runners.server.ts` when the literal
 * `runners` array lacks `name` (carrying the edit that adds it, and its import when missing), or on `<name>.server.ts`
 * when the module has no `runners.server.ts`.
 */
export function runnersFindings(
  file: SourceFile,
  ast: Program,
  project: readonly SourceFile[],
  name: string,
): Finding[] {
  const mf = moduleFile(file.path);
  if (mf === undefined) return [];
  const dir = `${mf.prefix}modules/${mf.id}/`;
  const own = `${name}.server.ts`;
  if (!project.some((f) => f.path === dir + own)) return [];
  const runnersFile = project.some((f) => f.path === `${dir}runners.server.ts`);
  if (mf.rest === own && !runnersFile) return [{ path: file.path, ...lineCol(file.source, 0), data: { name } }];
  if (mf.rest !== "runners.server.ts") return [];
  let imported = false;
  for (const st of ast.body) {
    if (st.type === "ImportDeclaration") imported ||= st.specifiers.some((s) => s.local.name === name);
    if (st.type !== "ExportNamedDeclaration" || st.declaration?.type !== "VariableDeclaration") continue;
    for (const d of st.declaration.declarations) {
      const list = d.init;
      if (d.id.type !== "Identifier" || d.id.name !== "runners" || list?.type !== "ArrayExpression") continue;
      if (list.elements.some((e) => e?.type === "Identifier" && e.name === name)) return [];
      const last = list.elements.at(-1);
      const at = last ? last.end : list.start + 1;
      const head = imported ? "" : `import { ${name} } from "./${own}"\n`;
      return [
        {
          path: file.path,
          ...lineCol(file.source, list.start),
          data: { name, at, text: last ? `, ${name}` : name, head },
        },
      ];
    }
  }
  return [];
}
