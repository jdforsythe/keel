import type MagicString from "magic-string";
import type { Program } from "oxc-parser";

const sourceOf = (line: string): string => /from\s+["']([^"']+)["']/.exec(line)?.[1] ?? "";
/** Biome's import order: packages, then `../`, then `./`; plain code-unit order inside a group. */
const rank = (spec: string): number => (spec.startsWith("../") ? 1 : spec.startsWith(".") ? 2 : 0);
const before = (a: string, b: string): boolean => (rank(a) !== rank(b) ? rank(a) < rank(b) : a < b);

/** Insert import lines in sorted position among the existing import declarations (or at the top). */
export function insertImports(ms: MagicString, program: Program, lines: readonly string[]): void {
  if (lines.length === 0) return;
  const decls = program.body.filter((s) => s.type === "ImportDeclaration");
  const sorted = [...lines].sort((a, b) => (before(sourceOf(a), sourceOf(b)) ? -1 : 1));
  if (decls.length === 0) {
    ms.prepend(`${sorted.join("\n")}\n\n`);
    return;
  }
  const tail: string[] = [];
  for (const line of sorted) {
    const next = decls.find((d) => before(sourceOf(line), d.source.value));
    if (next === undefined) tail.push(line);
    else ms.appendLeft(next.start, `${line}\n`);
  }
  const last = decls[decls.length - 1];
  if (last !== undefined && tail.length > 0) ms.appendLeft(last.end, `\n${tail.join("\n")}`);
}
