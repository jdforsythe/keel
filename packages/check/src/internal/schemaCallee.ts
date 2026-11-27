import { globalRefs } from "@keel/compiler/internal";
import type { Node, Program } from "oxc-parser";
import { localNames } from "./modules/localNames.ts";

/**
 * Whether a callee names `exported` of `@keel/schema` by spelling: a name it is imported under, or
 * `<namespace>.<exported>` of a namespace import, either one not shadowed where it is used. A function the file
 * declares itself is not it. With the type pass, `calleeUses` finds a callee by its symbol (k.unsafe One path).
 */
export function schemaCallee(ast: Program, exported: string): (callee: Node) => boolean {
  const names = localNames(ast, exported, "@keel/schema");
  const namespaces = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
    for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
  }
  if (names.size === 0 && namespaces.size === 0) return () => false;
  const g = globalRefs(ast);
  const bound = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
  return (c) =>
    c.type === "Identifier"
      ? names.has(c.name) && bound(c.name, c.start)
      : c.type === "MemberExpression" &&
        !c.computed &&
        c.object.type === "Identifier" &&
        namespaces.has(c.object.name) &&
        bound(c.object.name, c.object.start) &&
        c.property.name === exported;
}
