import { type Expression, type Program, Visitor } from "oxc-parser";

/**
 * The module specifiers a program imports or re-exports, with spans: `import`, `export { } from`, `export * from`, and
 * `import('x')` expressions and `require('x')` calls whose argument is a string literal or a template literal without
 * substitutions, and `import x = require('x')`. Type-only declarations (`import type`, `export type ... from`,
 * `import type x = require('x')`) are erased at compile time and are not sources.
 */
export function sourcesOf(program: Program): { readonly value: string; readonly start: number }[] {
  const out: { value: string; start: number }[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" && st.importKind !== "type") out.push(st.source);
    else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type") out.push(st.source);
    else if (st.type === "ExportNamedDeclaration" && st.source !== null && st.exportKind !== "type")
      out.push(st.source);
  }
  const literal = (s: Expression): void => {
    if (s.type === "Literal" && typeof s.value === "string") out.push({ value: s.value, start: s.start });
    else if (s.type === "TemplateLiteral" && s.expressions.length === 0) {
      const cooked = s.quasis[0]?.value.cooked;
      if (typeof cooked === "string") out.push({ value: cooked, start: s.start });
    }
  };
  new Visitor({
    ImportExpression: (n) => literal(n.source),
    CallExpression: (n) => {
      const arg = n.arguments[0];
      if (
        n.callee.type === "Identifier" &&
        n.callee.name === "require" &&
        arg !== undefined &&
        arg.type !== "SpreadElement"
      )
        literal(arg);
    },
    TSImportEqualsDeclaration: (n) => {
      const ref = n.moduleReference;
      if (n.importKind !== "type" && ref.type === "TSExternalModuleReference") literal(ref.expression);
    },
  }).visit(program);
  return out;
}
