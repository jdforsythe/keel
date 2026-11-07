import type { SourceFile } from "../types/SourceFile.ts";

/**
 * Every Conformance clause of every spec section: `{ id, n, text, line }`, `n` 1-based (k.testing Ledger items),
 * `line` the bullet's 1-based line in the section file.
 */
export function specClauses(files: readonly SourceFile[]): { id: string; n: number; text: string; line: number }[] {
  const out: { id: string; n: number; text: string; line: number }[] = [];
  for (const f of files) {
    const m = /^spec\/(?:kernel|std)\/([^/]+)\.md$/.exec(f.path);
    const id = m?.[1];
    if (id === undefined) continue;
    const lines = f.source.split("\n");
    const at = lines.findIndex((l) => l.startsWith("**Conformance.**"));
    if (at < 0) continue;
    let n = 0;
    for (const [i, l] of lines.slice(at + 1).entries()) {
      if (l.trim() === "" || l.startsWith("**")) break;
      if (!l.startsWith("- ")) continue;
      n++;
      out.push({ id, n, text: l.slice(2).trim(), line: at + i + 2 });
    }
  }
  return out;
}
