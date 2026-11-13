import { Visitor } from "oxc-parser";
import type { Program } from "oxc-parser";
import type { ModuleSpecifier } from "../types/ModuleSpecifier.ts";

/**
 * The string specifiers `ast` names: `import` (type-only too), `export ... from`, `export * from`, a literal
 * `import()`, and with `withRequire` a literal `require()`. Computed specifiers are not followed.
 */
export function moduleSpecifiers(ast: Program, withRequire: boolean): ModuleSpecifier[] {
  const out: ModuleSpecifier[] = [];
  const add = (at: number, spec: unknown): void => {
    if (typeof spec === "string") out.push({ at, spec });
  };
  for (const st of ast.body)
    if (st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration")
      add(st.start, st.source?.value);
  new Visitor({
    ImportExpression: (n) => add(n.start, n.source.type === "Literal" ? n.source.value : null),
    CallExpression: (n) => {
      const [a] = n.arguments;
      if (withRequire && n.callee.type === "Identifier" && n.callee.name === "require" && a?.type === "Literal")
        add(n.start, a.value);
    },
  }).visit(ast);
  return out;
}
