import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import type { JustifiedEntry } from "./JustifiedEntry.ts";
import { justifiedShape } from "./justifiedShape.ts";
import { justifiedText } from "./justifiedText.ts";
import { makeDiag } from "./makeDiag.ts";

const FILE = /^packages\/([^/]+)\/mutation-justified\.json$/;

/**
 * Each package's `mutation-justified.json` (k.ledger Justified survivors): the entries of every file that holds its
 * shape, by package with the file's path, and E1725 per bad entry of a file that does not (such a file justifies nothing).
 */
export function justifiedFiles(files: readonly SourceFile[]): {
  readonly justified: ReadonlyMap<string, { readonly path: string; readonly entries: readonly JustifiedEntry[] }>;
  readonly diags: readonly Diag[];
} {
  const justified = new Map<string, { path: string; entries: readonly JustifiedEntry[] }>();
  const diags: Diag[] = [];
  for (const f of files) {
    const pkg = FILE.exec(f.path)?.[1];
    if (pkg === undefined) continue;
    const at = { path: f.path, line: 1, col: 1, see: "k.ledger" };
    let doc: unknown;
    try {
      doc = JSON.parse(f.source);
    } catch {
      diags.push(makeDiag("E1725", "mutation-justified.json is not JSON", at));
      continue;
    }
    const { entries, problems } = justifiedShape(doc);
    for (const p of problems) {
      const text = p.original === undefined ? "" : ` (${justifiedText(p.original)})`;
      diags.push(makeDiag("E1725", p.index < 0 ? p.message : `entry ${p.index + 1}${text}: ${p.message}`, at));
    }
    if (problems.length === 0) justified.set(pkg, { path: f.path, entries });
  }
  return { justified, diags };
}
