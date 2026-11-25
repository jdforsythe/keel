import { isAstNode } from "../isAstNode.ts";

/** The names a parameter pattern binds, and the default values it holds (a reader reading parameters by name). */
export function bound(p: unknown, names: Set<string>, defaults: unknown[]): void {
  if (!isAstNode(p)) return;
  if (p.type === "Identifier" && typeof p.name === "string") names.add(p.name);
  else if (p.type === "AssignmentPattern") {
    bound(p.left, names, defaults);
    defaults.push(p.right);
  } else if (p.type === "RestElement") bound(p.argument, names, defaults);
  else if (p.type === "TSParameterProperty") bound(p.parameter, names, defaults);
  else if (p.type === "ArrayPattern" && Array.isArray(p.elements))
    for (const e of p.elements) bound(e, names, defaults);
  else if (p.type === "ObjectPattern" && Array.isArray(p.properties))
    for (const q of p.properties)
      bound(isAstNode(q) && q.type === "RestElement" ? q.argument : isAstNode(q) ? q.value : q, names, defaults);
}
