import { type CallExpression, type Program, Visitor } from "oxc-parser";

/** The calls in `ast` of export `name` of module `source`, through a named import under any local name. */
export function callsOf(ast: Program, source: string, name: string): CallExpression[] {
  const locals = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== source) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === name) locals.add(sp.local.name);
    }
  }
  const out: CallExpression[] = [];
  if (locals.size > 0)
    new Visitor({
      CallExpression(c) {
        if (c.callee.type === "Identifier" && locals.has(c.callee.name)) out.push(c);
      },
    }).visit(ast);
  return out;
}
