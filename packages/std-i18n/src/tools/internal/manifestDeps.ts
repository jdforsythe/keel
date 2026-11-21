import { type Expression, parseSync } from "oxc-parser";

/** `x as T`, `x satisfies T` and `(x)` unwrapped. */
function unwrap(e: Expression): Expression {
  let x = e;
  while (x.type === "TSAsExpression" || x.type === "TSSatisfiesExpression" || x.type === "ParenthesizedExpression")
    x = x.expression;
  return x;
}

/** The manifest object: a default-exported object literal, or the first argument of a default-exported call. */
function manifestObject(d: Expression): Expression | undefined {
  const x = unwrap(d);
  if (x.type !== "CallExpression") return x;
  const arg = x.arguments[0];
  return arg === undefined || arg.type === "SpreadElement" ? undefined : unwrap(arg);
}

/** The literal strings of a `module.ts` manifest's `deps` (k.module), read statically; empty when not literal. */
export function manifestDeps(source: string): readonly string[] {
  const { program } = parseSync("module.ts", source, { sourceType: "module", lang: "ts" });
  for (const st of program.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration")
      return [];
    const obj = manifestObject(d);
    if (obj?.type !== "ObjectExpression") return [];
    for (const p of obj.properties) {
      if (p.type !== "Property" || p.computed) continue;
      const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : null;
      if (key !== "deps") continue;
      const list = unwrap(p.value);
      if (list.type !== "ArrayExpression") return [];
      return list.elements.flatMap((el) => (el?.type === "Literal" && typeof el.value === "string" ? [el.value] : []));
    }
  }
  return [];
}
