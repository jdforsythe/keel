import { type Program, Visitor } from "oxc-parser";

/**
 * The module specifiers a program imports or re-exports, with spans: `import`, `export { } from`, `export * from`, and
 * `import('x')` expressions whose argument is a string literal or a template literal without substitutions. Type-only
 * declarations (`import type`, `export type ... from`) are erased at compile time and are not sources.
 */
export function sourcesOf(program: Program): { readonly value: string; readonly start: number }[] {
  const out: { value: string; start: number }[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" && st.importKind !== "type") out.push(st.source);
    else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type") out.push(st.source);
    else if (st.type === "ExportNamedDeclaration" && st.source !== null && st.exportKind !== "type")
      out.push(st.source);
  }
  new Visitor({
    ImportExpression: (n) => {
      const s = n.source;
      if (s.type === "Literal" && typeof s.value === "string") out.push({ value: s.value, start: s.start });
      else if (s.type === "TemplateLiteral" && s.expressions.length === 0) {
        const cooked = s.quasis[0]?.value.cooked;
        if (typeof cooked === "string") out.push({ value: cooked, start: s.start });
      }
    },
  }).visit(program);
  return out;
}
