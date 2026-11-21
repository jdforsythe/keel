import { Visitor } from "oxc-parser";
import type { Expression, Program } from "oxc-parser";
import type { ModuleSpecifier } from "../types/ModuleSpecifier.ts";

/** A string literal's value, or a template literal's with no substitutions; else null. */
function literal(e: Expression): unknown {
  if (e.type === "Literal") return e.value;
  if (e.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? null;
  return null;
}

/**
 * The string specifiers `ast` names: `import` (type-only too), `export ... from`, `export * from`, a literal
 * `import()`, and with `withRequire` a literal `require()`; a template literal with no substitutions is a literal.
 * Computed specifiers are not followed.
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
    ImportExpression: (n) => add(n.start, literal(n.source)),
    CallExpression: (n) => {
      const [a] = n.arguments;
      if (withRequire && n.callee.type === "Identifier" && n.callee.name === "require" && a !== undefined)
        add(n.start, a.type === "SpreadElement" ? null : literal(a));
    },
  }).visit(ast);
  return out;
}
