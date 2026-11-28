import { type Program, Visitor } from "oxc-parser";
import { urlLiterals } from "./urlLiterals.ts";

/**
 * The specifiers `program` reaches files by (k.boundary Reach, k.bundle Bundles): value imports and re-exports, literal
 * `import()`, and `new URL(<literal>, import.meta.url)`; each with its statement's or expression's start.
 */
export function importEdges(program: Program): { source: string; start: number }[] {
  const out: { source: string; start: number }[] = [];
  for (const s of program.body) {
    const value =
      s.type === "ImportDeclaration" ? s.importKind !== "type" : "exportKind" in s && s.exportKind !== "type";
    const from = "source" in s ? s.source : null;
    if (value && from !== null && from !== undefined && "value" in from && typeof from.value === "string")
      out.push({ source: from.value, start: s.start });
  }
  new Visitor({
    ImportExpression: (n) => {
      const x = n.source;
      const text =
        x.type === "Literal"
          ? x.value
          : x.type === "TemplateLiteral" && x.expressions.length === 0
            ? x.quasis[0]?.value.cooked
            : null;
      if (typeof text === "string") out.push({ source: text, start: n.start });
    },
  }).visit(program);
  out.push(...urlLiterals(program));
  return out.sort((a, b) => a.start - b.start);
}
