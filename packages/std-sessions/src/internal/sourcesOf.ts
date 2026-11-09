import { type Program, Visitor } from "oxc-parser";

/**
 * The module specifiers a program imports or re-exports, with spans: `import`, `export { } from`, `export * from`, and
 * `import('x')` expressions whose argument is a string literal.
 */
export function sourcesOf(program: Program): { readonly value: string; readonly start: number }[] {
  const out: { value: string; start: number }[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration") out.push(st.source);
    else if (st.type === "ExportNamedDeclaration" && st.source !== null) out.push(st.source);
  }
  new Visitor({
    ImportExpression: (n) => {
      const s = n.source;
      if (s.type === "Literal" && typeof s.value === "string") out.push({ value: s.value, start: s.start });
    },
  }).visit(program);
  return out;
}
