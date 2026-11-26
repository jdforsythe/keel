import type { Program } from "oxc-parser";
import type { Edit } from "../../types/Edit.ts";
import { importsOf } from "./importsOf.ts";

/**
 * The edits of `tokens.ts` that import `local` from `<name>/tokens` on a new line after the last import's line (or,
 * when a block comment begins on that line and ends on a later one, after the line that comment ends on: no comment
 * moves) and `defineTokens` from `@keel/ui` before the first import, each only when the file lacks it.
 */
export function importEdits(source: string, program: Program, local: string, name: string): Edit[] {
  const { from, lastEnd: end } = importsOf(program);
  const lineEndAt = (at: number): number => {
    const i = source.indexOf("\n", at);
    return i < 0 ? source.length : i;
  };
  let lineEnd = lineEndAt(end);
  const opener = source.slice(end, lineEnd).indexOf("/*");
  if (opener >= 0) {
    const close = source.indexOf("*/", end + opener + 2);
    if (close > lineEnd) lineEnd = lineEndAt(close);
  }
  const lastEnd = end === 0 ? 0 : lineEnd;
  const edits: Edit[] = [];
  if (from.get("defineTokens") !== "@keel/ui#defineTokens") {
    const first = program.body.find((s) => s.type === "ImportDeclaration");
    const at = first?.start ?? 0;
    edits.push({ start: at, end: at, text: 'import { defineTokens } from "@keel/ui";\n' });
  }
  if (!from.has(local))
    edits.push({
      start: lastEnd,
      end: lastEnd,
      text: `${lastEnd === 0 ? "" : "\n"}import { ${local} } from "${name}/tokens";\n`,
    });
  return edits;
}
