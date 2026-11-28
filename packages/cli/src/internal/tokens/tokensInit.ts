import type { Expression, Program } from "oxc-parser";

/** The initializer of `export const tokens = <init>` in a program, or undefined. */
export function tokensInit(program: Program): Expression | undefined {
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : null;
    if (decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.id.name === "tokens" && d.init !== null && d.init !== undefined)
        return d.init;
  }
  return undefined;
}
