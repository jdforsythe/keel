import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { LedgerEntry } from "./LedgerEntry.ts";
import { scrubCode } from "./scrubCode.ts";

const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*\(/g;
const PKG = /^packages\/([^/]+)\/([^/]+)\//;

/**
 * Port of tooling/ledger.mjs, pure over the given files: every exported function in `packages/<pkg>/src/*.ts`
 * with its rung (`probabilistic` when a fast-check test or conformance file references it, `example` when any
 * does, else `none`) and the count of `unsafe(...)` calls in src and unsafe.
 */
export function buildLedger(files: readonly SourceFile[]): { exports: LedgerEntry[]; unsafe: number } {
  const area = (f: SourceFile): { pkg: string; dir: string } | undefined => {
    const m = PKG.exec(f.path);
    return m?.[1] === undefined || m[2] === undefined ? undefined : { pkg: m[1], dir: m[2] };
  };
  const verif = files
    .filter((f) => CODE_FILE.test(f.path) && ["test", "conformance"].includes(area(f)?.dir ?? ""))
    .map((f) => ({ pkg: area(f)?.pkg ?? "", path: f.path, source: f.source, prop: f.source.includes("fast-check") }));
  let unsafe = 0;
  const exports: LedgerEntry[] = [];
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
      const hits = verif.filter((v) => v.pkg === at.pkg && word.test(v.source));
      const prop = hits.find((v) => v.prop);
      const rung = prop !== undefined ? "probabilistic" : hits.length > 0 ? "example" : "none";
      exports.push({ pkg: at.pkg, name, file: f.path, rung, evidence: (prop ?? hits[0])?.path ?? "none" });
    }
  }
  exports.sort((a, b) => (a.file + a.name < b.file + b.name ? -1 : a.file + a.name > b.file + b.name ? 1 : 0));
  return { exports, unsafe };
}
