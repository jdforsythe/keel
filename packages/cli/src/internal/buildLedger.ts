import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import { evidenceOf } from "./evidenceOf.ts";
import { scrubCode } from "./scrubCode.ts";
import { specClauses } from "./specClauses.ts";

const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*\(/g;
const PKG = /^packages\/([^/]+)\/([^/]+)\//;

/** The leading `//` comment lines of a file that carry `Spec:` (a conformance test names its clause there). */
const specHeader = (source: string): string => {
  const head: string[] = [];
  for (const l of source.split("\n")) {
    if (!l.startsWith("//")) break;
    head.push(l);
  }
  return head.filter((l) => l.includes("Spec:")).join("\n");
};

/**
 * Ledger items, pure over the given files (port of tooling/ledger.mjs plus spec clauses, k.testing Ledger):
 * every exported function in `packages/<pkg>/src/*.ts` with evidence from the package's test and conformance
 * files that reference it; every spec Conformance clause (`k.cli#7`) with evidence from conformance files whose
 * `// Spec:` header names the section and quotes the clause. Also the count of `unsafe(...)` calls.
 */
export function buildLedger(files: readonly SourceFile[]): { items: LedgerItem[]; unsafe: number } {
  const area = (f: SourceFile): { pkg: string; dir: string } | undefined => {
    const m = PKG.exec(f.path);
    return m?.[1] === undefined || m[2] === undefined ? undefined : { pkg: m[1], dir: m[2] };
  };
  const verif = files
    .filter((f) => CODE_FILE.test(f.path) && ["test", "conformance"].includes(area(f)?.dir ?? ""))
    .map((f) => ({ pkg: area(f)?.pkg ?? "", dir: area(f)?.dir ?? "", path: f.path, source: f.source }));
  let unsafe = 0;
  const exports: LedgerItem[] = [];
  for (const f of files) {
    const at = area(f);
    if (at === undefined || !CODE_FILE.test(f.path) || !["src", "unsafe"].includes(at.dir)) continue;
    const code = scrubCode(f.source);
    for (const l of code) unsafe += (l.match(UNSAFE_CALL) ?? []).length;
    if (at.dir !== "src" || !f.path.endsWith(".ts") || f.path.split("/").length !== 4) continue;
    for (const l of code) {
      const name = (FN_DECL.exec(l) ?? FN_CONST.exec(l))?.[1];
      if (name === undefined) continue;
      const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
      const evidence = verif
        .filter((v) => v.pkg === at.pkg && word.test(v.source))
        .map((v) => ({ ev: evidenceOf(v.source), path: v.path }));
      exports.push({ item: `${f.path}#${name}`, evidence });
    }
  }
  exports.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
  const headers = verif.filter((v) => v.dir === "conformance").map((v) => ({ ...v, header: specHeader(v.source) }));
  const clauses = specClauses(files).map(({ id, n, text }) => {
    const bare = text.replace(/\.$/, "");
    const evidence = headers
      .filter((h) => new RegExp(`Spec: ${id.replace(/\./g, "\\.")}\\b`).test(h.header) && h.header.includes(bare))
      .map((h) => ({ ev: evidenceOf(h.source), path: h.path }));
    return { item: `${id}#${n}`, evidence };
  });
  return { items: [...exports, ...clauses], unsafe };
}
