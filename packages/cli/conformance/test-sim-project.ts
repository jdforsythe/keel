// Support for conformance tests that run the real `keel` binary over a temp project. Not a test file.
// Projects live under the OS tmpdir, never under the repo; `node_modules` links `@keel/*` and the test toolchain.
// The child env drops vitest's own variables and every KEEL_* the outer run may carry, so only `keel` can set them.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeRunReports } from "./ledger-run-report.ts";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
const BIN = join(root, "packages", "cli", "src", "bin.ts");
const VITEST = join(root, "node_modules", "vitest", "vitest.mjs");
const KEEL_PACKAGES = ["ctx", "schema", "testing"];
const EXTERNAL = ["vitest", "vite", "fast-check", "happy-dom", "typescript"];

export type CliRecord = { kind: string; [key: string]: unknown };
export type Run = { status: number | null; records: CliRecord[]; stdout: string };

const isRecord = (v: unknown): v is CliRecord =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

/** A temp project with `files` written and `node_modules` linked; remove it with `removeProject`. */
export function makeProject(prefix: string, files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), `keel-${prefix}-`));
  writeFiles(dir, files);
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const p of KEEL_PACKAGES) symlinkSync(join(root, "packages", p), join(dir, "node_modules", "@keel", p));
  for (const e of EXTERNAL) symlinkSync(join(root, "node_modules", e), join(dir, "node_modules", e));
  return dir;
}

export function writeFiles(dir: string, files: Readonly<Record<string, string>>): void {
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), source);
  }
}

export function removeFile(dir: string, path: string): void {
  rmSync(join(dir, path), { force: true });
}

export function removeProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** The process env without vitest's variables and without any KEEL_* (the contract under test). */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  return env;
}

const parse = (stdout: string): CliRecord[] => {
  const out: CliRecord[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const v: unknown = JSON.parse(line);
    if (!isRecord(v)) throw new Error(`json line without kind: ${line}`);
    out.push(v);
  }
  return out;
};

/**
 * The real `keel` binary (`node packages/cli/src/bin.ts`) in `dir`, `--format=json`.
 * Before a `ledger` run each project of `dir` gets the run report of its test files as they are
 * (ledger-run-report.ts), so a fixture's rung stands on a run; `reports: "none"` leaves `dir` as the case made it.
 */
export function keel(dir: string, args: readonly string[], opts: { reports?: "auto" | "none" } = {}): Run {
  if (args[0] === "ledger" && opts.reports !== "none") writeRunReports(dir);
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env: cleanEnv(),
  });
  return { status: r.status, records: parse(r.stdout), stdout: r.stdout };
}

/** Control: vitest itself in `dir`, with the same clean env and no `keel` in between. */
export function plainVitest(dir: string): { status: number | null } {
  const r = spawnSync(process.execPath, [VITEST, "run", "--root", dir], {
    cwd: dir,
    encoding: "utf8",
    env: cleanEnv(),
  });
  return { status: r.status };
}

export const summaryOf = (run: Run): CliRecord | undefined => run.records.filter((r) => r.kind === "summary").at(-1);
