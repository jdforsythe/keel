// Shared helpers for the RFC 0242 check conformance files (not a test file). Public API only. Seed 1337.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { tempDir } from "@keel/tooling/test-tmp";
import { type Files, manifestFile } from "./module-support.ts";

export type { Files };
export const PATH = "modules/m/a.ts";
export const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
export type Diag = ReturnType<typeof check>["diagnostics"][number];

/** Check one module file of module `m` (in-memory, no type pass unless `types`). */
export const run = (source: string, opts: { path?: string; types?: boolean } = {}): readonly Diag[] =>
  check([MANIFEST, { path: opts.path ?? PATH, source }], { types: opts.types ?? false }).diagnostics;
export const of = (ds: readonly Diag[], code: string): Diag[] => ds.filter((d) => d.code === code);

/** The 1-based line and column of the first `needle` in `source`, searching after `after`. */
export const at = (source: string, needle: string, after = ""): { line: number; col: number } => {
  const i = source.indexOf(needle, after === "" ? 0 : source.indexOf(after));
  const before = source.slice(0, i).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

/** Write `files` to a fresh folder, `git apply` `fix` there and return the patched files. */
export function applyFix(files: Files, fix: string): Files {
  const dir = tempDir("keel-fix-");
  for (const f of files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.source);
  }
  writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
  execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
  return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
}

/** Everything `keel check` reports on `files` with the type pass on: the type check of a fixture project is this call (E1751 is a TypeScript error). */
export const checked = (files: Files): readonly Diag[] => check(files, { types: true }).diagnostics;
export const codesOf = (ds: readonly Diag[]): string[] => ds.map((d) => d.code);
