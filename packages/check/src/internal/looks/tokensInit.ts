import type { Expression, Program } from "oxc-parser";

/** The `export const tokens = <init>` initializer of `tokens.ts`, or undefined. */
export function tokensInit(program: Program): { readonly init: Expression; readonly name: number } | undefined {
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : null;
    if (decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.id.name === "tokens" && d.init !== null && d.init !== undefined)
        return { init: d.init, name: d.id.start };
  }
  return undefined;
}
