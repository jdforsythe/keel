import { globalRefs } from "@keel/compiler/internal";
import { type Node, type Program, Visitor } from "oxc-parser";
import { localNames } from "./modules/localNames.ts";

/**
 * Whether a callee names `exported` of package `source` by spelling: a name it is imported under, a `const` bound to
 * such a name, or `<namespace>.<exported>` of a namespace import, none shadowed where it is used. With the type pass,
 * the callee is found by its symbol instead (k.unsafe One path); this is the reading under `types: false`.
 */
export function packageCallee(ast: Program, source: string, exported: string): (callee: Node) => boolean {
  const names = new Set(localNames(ast, exported, source));
  const namespaces = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== source) continue;
    for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
  }
  if (names.size === 0 && namespaces.size === 0) return () => false;
  const aliases = new Set<string>();
  new Visitor({
    VariableDeclaration: (d) => {
      if (d.kind !== "const") return;
      for (const v of d.declarations) {
        const init = v.init;
        if (v.id.type !== "Identifier" || init === null) continue;
        if (init.type === "Identifier" && names.has(init.name)) aliases.add(v.id.name);
        else if (
          init.type === "MemberExpression" &&
          !init.computed &&
          init.object.type === "Identifier" &&
          namespaces.has(init.object.name) &&
          init.property.name === exported
        )
          aliases.add(v.id.name);
      }
    },
  }).visit(ast);
  const g = globalRefs(ast);
  const bound = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
  const test = (c: Node): boolean => {
    if (c.type === "ParenthesizedExpression") return test(c.expression);
    if (c.type === "Identifier") return (names.has(c.name) && bound(c.name, c.start)) || aliases.has(c.name);
    return (
      c.type === "MemberExpression" &&
      !c.computed &&
      c.object.type === "Identifier" &&
      namespaces.has(c.object.name) &&
      bound(c.object.name, c.object.start) &&
      c.property.name === exported
    );
  };
  return test;
}
