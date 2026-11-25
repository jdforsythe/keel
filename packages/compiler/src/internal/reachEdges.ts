import { type Program, Visitor } from "oxc-parser";
import type { Resolve } from "./Resolve.ts";
import { importEdges } from "./importEdges.ts";
import { templatePattern } from "./templatePattern.ts";

/**
 * The edges reach follows out of file `from` (k.boundary Following): each of `importEdges` with the project file
 * `resolve` names (none for a package's), and each `import()` of a template literal with a relative head, with every
 * file of `known` its pattern matches (`pattern`). `source` is the specifier as written (a template's raw text), `start` its
 * statement's or expression's start.
 */
export function reachEdges(
  from: string,
  program: Program,
  resolve: Resolve,
  known: Iterable<string>,
): { source: string; start: number; files: string[]; pattern: boolean }[] {
  const out = importEdges(program).map((e) => {
    const file = resolve(from, e.source.split("?")[0] ?? e.source);
    return { ...e, files: file === undefined ? [] : [file], pattern: false };
  });
  const all = [...known];
  new Visitor({
    ImportExpression: (n) => {
      const x = n.source;
      const pattern = x.type === "TemplateLiteral" ? templatePattern(from, x) : undefined;
      if (x.type !== "TemplateLiteral" || pattern === undefined) return;
      const source = x.quasis.map((q) => q.value.raw).join("*");
      out.push({ source, start: n.start, files: all.filter((p) => p !== from && pattern.test(p)), pattern: true });
    },
  }).visit(program);
  return out.sort((a, b) => a.start - b.start);
}
