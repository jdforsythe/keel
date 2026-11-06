import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

const SKIP = new Set(["node_modules", "dist", "coverage", "reports", ".turbo", ".git", ".worktrees"]);
const WANT = (rel: string): boolean =>
  CODE_FILE.test(rel) ||
  (rel.startsWith("spec/") && rel.endsWith(".md")) ||
  (rel.startsWith(".keel/") && rel.endsWith(".json")) ||
  rel === "tooling/ledger/ledger.json";

/** Binary only: read the project under `cwd` into engine files (code, spec markdown, ledger and `.keel` artifacts). */
export function readProject(cwd: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(join(dir, e.name), r);
      } else if (e.isFile() && WANT(r)) out.push({ path: r, source: readFileSync(join(dir, e.name), "utf8") });
    }
  };
  walk(cwd, "");
  return out;
}
