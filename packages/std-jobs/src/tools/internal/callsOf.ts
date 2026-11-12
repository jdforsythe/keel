import { type CallExpression, type Program, Visitor } from "oxc-parser";

/**
 * The calls in `ast` of export `name` of module `source`, through a named import under any local name or a namespace
 * import (`ns.name(...)`).
 */
export function callsOf(ast: Program, source: string, name: string): CallExpression[] {
  const locals = new Set<string>();
  const spaces = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== source) continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === name) locals.add(sp.local.name);
    }
  }
  const out: CallExpression[] = [];
  if (locals.size > 0 || spaces.size > 0)
    new Visitor({
      CallExpression(c) {
        const f = c.callee;
        if (f.type === "Identifier" ? locals.has(f.name) : isMember(f, spaces, name)) out.push(c);
      },
    }).visit(ast);
  return out;
}

function isMember(f: CallExpression["callee"], spaces: ReadonlySet<string>, name: string): boolean {
  return (
    f.type === "MemberExpression" &&
    !f.computed &&
    f.object.type === "Identifier" &&
    spaces.has(f.object.name) &&
    f.property.type === "Identifier" &&
    f.property.name === name
  );
}
