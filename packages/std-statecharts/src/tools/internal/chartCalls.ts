import type { Node } from "./Node.ts";
import { isNode } from "./isNode.ts";
import { unwrap } from "./unwrap.ts";

/**
 * The `chart` calls in `ast`, imported from `@keel/std-statecharts` by name (any local name) or as a namespace, or
 * through a `const` bound directly to it.
 */
export function chartCalls(ast: unknown): Node[] {
  const locals = new Set<string>();
  const spaces = new Set<string>();
  const body = isNode(ast) && Array.isArray(ast.body) ? ast.body : [];
  for (const st of body) {
    if (!isNode(st) || st.type !== "ImportDeclaration" || !isNode(st.source)) continue;
    if (st.source.value !== "@keel/std-statecharts" || !Array.isArray(st.specifiers)) continue;
    for (const sp of st.specifiers) {
      if (!isNode(sp) || !isNode(sp.local) || typeof sp.local.name !== "string") continue;
      if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
      const imported = isNode(sp.imported) ? (sp.imported.name ?? sp.imported.value) : undefined;
      if (sp.type === "ImportSpecifier" && imported === "chart") locals.add(sp.local.name);
    }
  }
  const out: Node[] = [];
  if (locals.size === 0 && spaces.size === 0) return out;
  const isChart = (f: Node): boolean =>
    (f.type === "Identifier" && typeof f.name === "string" && locals.has(f.name)) ||
    (f.type === "MemberExpression" &&
      f.computed !== true &&
      isNode(f.object) &&
      typeof f.object.name === "string" &&
      spaces.has(f.object.name) &&
      isNode(f.property) &&
      f.property.name === "chart");
  // A `const` bound directly to `chart` (`const c = chart`, `const c = ns.chart`) is `chart` too.
  const aliases = (x: unknown): boolean => {
    let grew = false;
    if (Array.isArray(x)) for (const v of x) grew = aliases(v) || grew;
    if (!isNode(x)) return grew;
    const init = unwrap(x.init);
    if (x.type === "VariableDeclarator" && isNode(x.id) && typeof x.id.name === "string" && init !== undefined)
      if (isChart(init) && !locals.has(x.id.name)) {
        locals.add(x.id.name);
        grew = true;
      }
    for (const [k, v] of Object.entries(x))
      if (k !== "start" && k !== "end" && typeof v === "object") grew = aliases(v) || grew;
    return grew;
  };
  while (aliases(ast));
  const visit = (x: unknown): void => {
    if (Array.isArray(x)) for (const v of x) visit(v);
    if (!isNode(x)) return;
    if (x.type === "CallExpression" && isNode(x.callee) && isChart(x.callee)) out.push(x);
    for (const [k, v] of Object.entries(x)) if (k !== "start" && k !== "end" && typeof v === "object") visit(v);
  };
  visit(ast);
  return out;
}
