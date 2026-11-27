import { Visitor } from "oxc-parser";
import type { Program } from "oxc-parser";
import type { SpecifierLiteral } from "./SpecifierLiteral.ts";

/**
 * The specifiers `ast` imports a value by: an `import` that is not `import type` nor all type specifiers, a value
 * `export ... from` that is not all type specifiers or `export * from`, and a literal `import()`. `start` is the opening quote.
 */
export function valueImportSites(ast: Program): SpecifierLiteral[] {
  const out: SpecifierLiteral[] = [];
  const add = (x: { readonly value: unknown; readonly start: number; readonly end: number }): void => {
    if (typeof x.value === "string") out.push({ spec: x.value, start: x.start, end: x.end });
  };
  for (const st of ast.body) {
    if (st.type === "ImportDeclaration") {
      const types =
        st.specifiers.length > 0 && st.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type");
      if (st.importKind !== "type" && !types) add(st.source);
    } else if (st.type === "ExportNamedDeclaration") {
      const types = st.specifiers.length > 0 && st.specifiers.every((s) => s.exportKind === "type");
      if (st.source !== null && st.exportKind !== "type" && !types) add(st.source);
    } else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type") add(st.source);
  }
  new Visitor({
    ImportExpression: (n) => {
      const s = n.source;
      if (s.type === "Literal") add(s);
      else if (s.type === "TemplateLiteral" && s.expressions.length === 0)
        add({ value: s.quasis[0]?.value.cooked, start: s.start, end: s.end });
    },
  }).visit(ast);
  return out;
}
