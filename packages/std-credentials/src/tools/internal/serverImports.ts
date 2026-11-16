import type { RuleInput } from "@keel/check";

const SERVER = "@keel/std-credentials/server";

/**
 * The offset of each top-level import or re-export of `@keel/std-credentials/server` in a file. A type-only
 * declaration (`import type`, `export type`) loads nothing, so it is not counted.
 */
export function serverImports(ast: RuleInput["ast"]): number[] {
  const out: number[] = [];
  for (const st of ast.body) {
    const from =
      st.type === "ImportDeclaration"
        ? st.importKind === "type"
          ? null
          : st.source
        : st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration"
          ? st.exportKind === "type"
            ? null
            : st.source
          : null;
    if (from !== null && from.value === SERVER) out.push(from.start);
  }
  return out;
}
