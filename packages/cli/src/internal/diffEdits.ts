import type { TextEdit } from "./TextEdit.ts";

const at = (line: number): { line: number; character: number } => ({ line: Math.max(0, line), character: 0 });

/**
 * A unified diff (a check `fix`) as LSP TextEdits per file path (from `+++ b/<path>`, else `--- a/<path>`).
 * Each hunk replaces its old lines with its new lines (context lines included), against the original text.
 */
export function diffEdits(diff: string): Map<string, TextEdit[]> {
  const out = new Map<string, TextEdit[]>();
  let path: string | undefined;
  let hunk: { start: number; count: number; text: string[] } | undefined;
  const flush = (): void => {
    if (path === undefined || hunk === undefined) return;
    const start = hunk.count === 0 ? hunk.start : hunk.start - 1;
    const edit: TextEdit = {
      range: { start: at(start), end: at(start + hunk.count) },
      newText: hunk.text.map((l) => `${l}\n`).join(""),
    };
    out.set(path, [...(out.get(path) ?? []), edit]);
    hunk = undefined;
  };
  for (const l of diff.split("\n")) {
    if (l.startsWith("--- ")) {
      flush();
      path = l.startsWith("--- a/") ? l.slice(6) : undefined;
    } else if (l.startsWith("+++ ")) {
      if (l.startsWith("+++ b/")) path = l.slice(6);
    } else if (l.startsWith("@@")) {
      flush();
      const m = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(l);
      if (m?.[1] !== undefined) hunk = { start: Number(m[1]), count: m[2] === undefined ? 1 : Number(m[2]), text: [] };
    } else if (hunk !== undefined && (l.startsWith(" ") || l.startsWith("+"))) hunk.text.push(l.slice(1));
  }
  flush();
  return out;
}
