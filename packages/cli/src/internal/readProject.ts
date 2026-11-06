import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

const SKIP = new Set(["node_modules", "dist", "coverage", "reports", ".turbo", ".git", ".worktrees"]);
const TEXT = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|css|html|txt)$/;
const MAX_BYTES = 1_000_000;
const QUERY = (rel: string): boolean =>
  CODE_FILE.test(rel) ||
  (rel.startsWith("spec/") && rel.endsWith(".md")) ||
  (rel.startsWith(".keel/") && rel.endsWith(".json")) ||
  rel === "tooling/ledger/ledger.json";

/**
 * Binary only: read the project under `cwd` into engine files. `query` (check, spec, ledger, test): code, spec
 * markdown, `.keel` artifacts and the ledger. `tree` (scaffold, codemod, build): every text file under 1 MB,
 * since structural operations read manifests, `package.json`, `turbo.json` and CI files too.
 */
export function readProject(cwd: string, scope: "query" | "tree"): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const want = (rel: string, abs: string): boolean =>
    scope === "query" ? QUERY(rel) : TEXT.test(rel) && statSync(abs).size <= MAX_BYTES;
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(abs, r);
      } else if (e.isFile() && want(r, abs)) out.push({ path: r, source: readFileSync(abs, "utf8") });
    }
  };
  walk(cwd, "");
  return out;
}
