import type { Program } from "oxc-parser";

/** Each imported local name and the `<specifier>#<imported name>` it comes from, and where the last import ends. */
export function importsOf(program: Program): { readonly from: ReadonlyMap<string, string>; readonly lastEnd: number } {
  const from = new Map<string, string>();
  let lastEnd = 0;
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    lastEnd = st.end;
    for (const sp of st.specifiers)
      if (sp.type === "ImportSpecifier")
        from.set(sp.local.name, `${st.source.value}#${sp.imported.type === "Identifier" ? sp.imported.name : ""}`);
  }
  return { from, lastEnd };
}
