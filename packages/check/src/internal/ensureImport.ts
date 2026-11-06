import type { Program } from "oxc-parser";
import type { Edit } from "../types/Edit.ts";

/**
 * Edits that make `name` importable from `module`: none when already imported, `, name` appended to an
 * existing named value import of `module`, else a new import line at the top of the file.
 */
export function ensureImport(program: Program, name: string, module: string): Edit[] {
  let target: { end: number } | null = null;
  for (const s of program.body) {
    if (s.type !== "ImportDeclaration" || s.source.value !== module) continue;
    for (const sp of s.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === name && sp.local.name === name) return [];
    }
    const last = s.specifiers[s.specifiers.length - 1];
    if (s.importKind !== "type" && last?.type === "ImportSpecifier") target = last;
  }
  if (target !== null) return [{ start: target.end, end: target.end, text: `, ${name}` }];
  return [{ start: 0, end: 0, text: `import { ${name} } from "${module}";\n` }];
}
