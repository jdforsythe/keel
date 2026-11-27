import type { Evidence } from "@keel/testing";
import ts from "typescript";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { Diag } from "./Diag.ts";
import { MonitoredSchema } from "./MonitoredSchema.ts";
import { isTestFile } from "./isTestFile.ts";
import { makeDiag } from "./makeDiag.ts";

const MONITORED = /(?:^|\/)\.keel\/monitored\.json$/;

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * `monitored` evidence by source file (k.ledger Production evidence): each `<dir>/.keel/monitored.json` covers the code
 * files under `<dir>`; a transaction with `runs` >= 1 gives `{ runs, to }` to every file holding its name as a string
 * literal (in the syntax tree: never a comment), else to every file holding its longest dotted prefix of two or more
 * segments that any file holds (a chart id). A file failing the
 * shape is E1711 and gives nothing.
 */
export function monitoredEvidence(files: readonly SourceFile[]): {
  byFile: Map<string, { ev: Evidence; path: string }[]>;
  diags: Diag[];
} {
  const byFile = new Map<string, { ev: Evidence; path: string }[]>();
  const diags: Diag[] = [];
  const literals = new Map<string, Set<string>>();
  const holds = (f: SourceFile): Set<string> => {
    let set = literals.get(f.path);
    if (set === undefined) {
      const found = new Set<string>();
      const visit = (n: ts.Node): void => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.add(n.text);
        ts.forEachChild(n, visit);
      };
      visit(
        ts.createSourceFile(
          f.path,
          f.source,
          ts.ScriptTarget.Latest,
          true,
          /\.[jt]sx$/.test(f.path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
      );
      set = found;
      literals.set(f.path, set);
    }
    return set;
  };
  for (const m of files.filter((f) => MONITORED.test(f.path))) {
    const tally = MonitoredSchema.parse(parse(m.source));
    if (!tally.ok) {
      diags.push(
        makeDiag("E1711", ".keel/monitored.json fails its shape; it adds no evidence", {
          path: m.path,
          line: 1,
          col: 1,
          see: "k.ledger",
        }),
      );
      continue;
    }
    const dir = m.path.slice(0, m.path.length - ".keel/monitored.json".length);
    const code = files.filter((f) => f.path.startsWith(dir) && CODE_FILE.test(f.path) && !isTestFile(f.path));
    for (const [name, runs] of Object.entries(tally.value.tx)) {
      if (runs < 1) continue;
      const parts = name.split(".");
      // The name itself, then its dotted prefixes down to two segments (a chart id), never one segment.
      for (let n = parts.length; n >= Math.min(2, parts.length); n--) {
        const id = parts.slice(0, n).join(".");
        const holders = code.filter((f) => holds(f).has(id));
        if (holders.length === 0) continue;
        for (const f of holders)
          byFile.set(f.path, [
            ...(byFile.get(f.path) ?? []),
            { ev: { kind: "monitored", passed: true, runs, to: tally.value.to }, path: m.path },
          ]);
        break;
      }
    }
  }
  return { byFile, diags };
}
