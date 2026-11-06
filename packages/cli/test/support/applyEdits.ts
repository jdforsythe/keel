import type { TextEdit } from "../../src/internal/TextEdit.ts";

/** Apply line-based LSP TextEdits (character 0 ranges, against the original) to text. Test helper. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  const sorted = [...edits].sort((a, b) => b.range.start.line - a.range.start.line);
  for (const e of sorted) {
    const added = e.newText === "" ? [] : e.newText.replace(/\n$/, "").split("\n");
    lines.splice(e.range.start.line, e.range.end.line - e.range.start.line, ...added);
  }
  return lines.map((l) => `${l}\n`).join("");
}
