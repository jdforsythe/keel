import type MagicString from "magic-string";
import type { Program } from "oxc-parser";

/** Insert import lines after the last import declaration (or at the top). */
export function insertImports(ms: MagicString, program: Program, lines: readonly string[]): void {
  if (lines.length === 0) return;
  let end = -1;
  for (const s of program.body) if (s.type === "ImportDeclaration") end = s.end;
  if (end >= 0) ms.appendLeft(end, `\n${lines.join("\n")}`);
  else ms.prepend(`${lines.join("\n")}\n\n`);
}
