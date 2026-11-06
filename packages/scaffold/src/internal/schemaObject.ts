import type { ObjectExpression, Program } from "oxc-parser";

/** The shape literal of a top-level `export const <name> = s.object({...})`, or null. */
export function schemaObject(program: Program, name: string): ObjectExpression | null {
  for (const st of program.body) {
    if (st.type !== "ExportNamedDeclaration" || st.declaration?.type !== "VariableDeclaration") continue;
    for (const d of st.declaration.declarations) {
      if (d.id.type !== "Identifier" || d.id.name !== name || d.init?.type !== "CallExpression") continue;
      const c = d.init.callee;
      const arg = d.init.arguments[0];
      if (
        c.type === "MemberExpression" &&
        !c.computed &&
        c.object.type === "Identifier" &&
        c.object.name === "s" &&
        c.property.type === "Identifier" &&
        c.property.name === "object" &&
        arg?.type === "ObjectExpression"
      )
        return arg;
    }
  }
  return null;
}
