import type { Ast } from "./Ast.ts";

/** The named imports of `ast`: each binding's local name, its source with no `.ts` or `.js` extension, and the name it imports. */
export function importsOf(ast: Ast): { readonly local: string; readonly from: string; readonly name: string }[] {
  return ast.body.flatMap((st) =>
    st.type === "ImportDeclaration"
      ? st.specifiers.flatMap((sp) =>
          sp.type === "ImportSpecifier"
            ? [
                {
                  local: sp.local.name,
                  from: st.source.value.replace(/\.[jt]s$/, ""),
                  name: sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value,
                },
              ]
            : [],
        )
      : [],
  );
}
