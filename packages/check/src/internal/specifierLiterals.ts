import { Visitor } from "oxc-parser";
import type { Expression, Program } from "oxc-parser";

/** Where a module specifier's literal sits: its value, and the offsets of its opening quote and of the closing one. */
export type SpecifierLiteral = { readonly spec: string; readonly start: number; readonly end: number };

/**
 * The string literals `ast` names modules by: `import` (type-only too), `export ... from`, `export * from` and a
 * literal `import()` (a template literal with no substitutions is one). `start` is the opening quote, `end` the offset
 * after the closing one. Computed specifiers are not followed.
 */
export function specifierLiterals(ast: Program): SpecifierLiteral[] {
  const out: SpecifierLiteral[] = [];
  const add = (x: Expression | null | undefined): void => {
    if (x === null || x === undefined) return;
    const spec = x.type === "Literal" ? x.value : x.type === "TemplateLiteral" && x.expressions.length === 0 ? x.quasis[0]?.value.cooked : null;
    if (typeof spec === "string") out.push({ spec, start: x.start, end: x.end });
  };
  for (const st of ast.body)
    if (st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration")
      add(st.source);
  new Visitor({ ImportExpression: (n) => add(n.source) }).visit(ast);
  return out;
}
