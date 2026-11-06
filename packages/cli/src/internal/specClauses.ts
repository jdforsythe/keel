import type { SourceFile } from "../types/SourceFile.ts";

/** Every Conformance clause of every spec section: `{ id, n, text }`, `n` 1-based (k.testing Ledger items). */
export function specClauses(files: readonly SourceFile[]): { id: string; n: number; text: string }[] {
  const out: { id: string; n: number; text: string }[] = [];
  for (const f of files) {
    const m = /^spec\/(?:kernel|std)\/([^/]+)\.md$/.exec(f.path);
    const id = m?.[1];
    if (id === undefined) continue;
    const lines = f.source.split("\n");
    const at = lines.findIndex((l) => l.startsWith("**Conformance.**"));
    if (at < 0) continue;
    let n = 0;
    for (const l of lines.slice(at + 1)) {
      if (l.trim() === "" || l.startsWith("**")) break;
      if (!l.startsWith("- ")) continue;
      n++;
      out.push({ id, n, text: l.slice(2).trim() });
    }
  }
  return out;
}
