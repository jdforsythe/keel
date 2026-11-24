import { type Expression, parseSync } from "oxc-parser";

/**
 * Where deployable `name` sits in `source` (`topology.ts`), read statically: `key`, the offset of its key (0 when none);
 * `body`, the offset immediately after the `{` of its object-literal value and `empty` when that object holds no property.
 */
export function topologyEntry(
  source: string,
  name: string,
): { readonly key: number; readonly body?: number; readonly empty?: boolean } {
  const { program } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  let e: Expression | undefined;
  for (const s of program.body)
    if (s.type === "ExportDefaultDeclaration" && s.declaration.type !== "FunctionDeclaration")
      if (s.declaration.type !== "ClassDeclaration" && s.declaration.type !== "TSInterfaceDeclaration")
        e = s.declaration;
  while (e !== undefined && e.type !== "ObjectExpression") {
    if (e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression")
      e = e.expression;
    else if (e.type === "CallExpression") e = e.arguments[0]?.type === "SpreadElement" ? undefined : e.arguments[0];
    else e = undefined;
  }
  for (const p of e?.properties ?? []) {
    if (p.type !== "Property" || p.computed) continue;
    const k = p.key;
    if ((k.type === "Identifier" ? k.name : k.type === "Literal" ? k.value : undefined) !== name) continue;
    const v = p.value;
    return v.type === "ObjectExpression"
      ? { key: k.start, body: v.start + 1, empty: v.properties.length === 0 }
      : { key: k.start };
  }
  return { key: 0 };
}
