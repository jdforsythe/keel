import { type Program, Visitor } from "oxc-parser";
import type { ImportRef } from "./ImportRef.ts";

/** Every static import, re-export, and literal dynamic `import()` specifier of a program, in source order. */
export function importRefs(program: Program): ImportRef[] {
  const out: ImportRef[] = [];
  const add = (n: { value: unknown; start: number; end: number }): void => {
    if (typeof n.value === "string") out.push({ spec: n.value, start: n.start, end: n.end });
  };
  new Visitor({
    ImportDeclaration: (n) => add(n.source),
    ExportAllDeclaration: (n) => add(n.source),
    ExportNamedDeclaration: (n) => {
      if (n.source) add(n.source);
    },
    ImportExpression: (n) => {
      if (n.source.type === "Literal") add(n.source);
    },
  }).visit(program);
  return out.sort((a, b) => a.start - b.start);
}
