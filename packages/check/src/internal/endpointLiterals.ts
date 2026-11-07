import { type Program, Visitor } from "oxc-parser";
import type { EndpointLiteral } from "./EndpointLiteral.ts";

/**
 * Every endpoint object literal in `endpoints({ key: { ... } })` calls, where `endpoints` is imported from
 * `@keel/services` (named, aliased, or through a namespace import). Entries that are not object literals are skipped.
 */
export function endpointLiterals(ast: Program): EndpointLiteral[] {
  const locals = new Set<string>();
  const namespaces = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/services") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
      else if (sp.type === "ImportSpecifier") {
        const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
        if (imported === "endpoints") locals.add(sp.local.name);
      }
    }
  }
  const out: EndpointLiteral[] = [];
  if (locals.size === 0 && namespaces.size === 0) return out;
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      const hit =
        (c.type === "Identifier" && locals.has(c.name)) ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          c.object.type === "Identifier" &&
          namespaces.has(c.object.name) &&
          c.property.type === "Identifier" &&
          c.property.name === "endpoints");
      const arg = n.arguments[0];
      if (!hit || arg?.type !== "ObjectExpression") return;
      for (const p of arg.properties) {
        if (p.type !== "Property" || p.value.type !== "ObjectExpression") continue;
        const name = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : "";
        out.push({ name, obj: p.value });
      }
    },
  }).visit(ast);
  return out;
}
