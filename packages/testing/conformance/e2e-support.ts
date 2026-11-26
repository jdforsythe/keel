// Support for the k.e2e and k.e2e-page conformance files (not a test file): a built-app fixture project in the OS tmpdir with `@keel/*`
// linked, the real `keel test --e2e` binary over it as a child process, and its reports read back. Seed 1337 for every property.
// How the browser cases run: they have no skip guard. Each file runs `keel test --e2e` once over a fixture project whose e2e files hold
// the clause's test, then reads the run's output and `reports/tests/e2e.json`. Where `playwright-core` or the browser is absent the
// product's own E1734 fails the run and so every case of the file: nothing here skips (k.e2e Browser). A builder must provide:
// Node 22.13 or later (`'sqlite'`), `playwright-core` resolvable from the repo's `node_modules` (a `devDependency` of the repo root or
// of `@keel/testing`), and Chromium installed by `playwright-core install chromium`; CI's `test-shard` jobs for `@keel/testing` and
// `@keel/cli` run these files, so each installs Chromium first (tooling/ci.source.json's `built-smokes` job does it with
// `pnpm exec playwright install --with-deps chromium`).
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Tree } from "./fixtures/e2e/node-app.ts";

export const SEED = 1337;
export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

/** Resolves `playwright-core` from the repo: the hoisted link when there is one, else the pnpm store's copy. */
function playwrightCore(): string | undefined {
  const hoisted = join(REPO, "node_modules", "playwright-core");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  if (!existsSync(store)) return undefined;
  const found = readdirSync(store).find((n) => n.startsWith("playwright-core@"));
  return found === undefined ? undefined : join(store, found, "node_modules", "playwright-core");
}

export type Made = { dir: string };
const made: string[] = [];
/** Removes every project this file made; call it from `afterAll`. */
export const cleanup = (): void => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
};

/**
 * A project of `tree` in a new folder under the OS tmpdir with `@keel/*`, `vitest`, `vite`, `typescript` and `fast-check` linked, and,
 * unless `playwright` is false, `playwright-core` (absent from the project's resolution when false).
 */
export function project(tree: Tree, opts: { playwright?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-e2e-"));
  made.push(dir);
  write(dir, tree);
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules", "@keel", pkg));
  for (const name of ["vitest", "vite", "typescript", "fast-check", "happy-dom"]) {
    const from = join(REPO, "node_modules", name);
    if (existsSync(from)) symlinkSync(from, join(dir, "node_modules", name));
  }
  const pw = playwrightCore();
  if (opts.playwright !== false && pw !== undefined) symlinkSync(pw, join(dir, "node_modules", "playwright-core"));
  return dir;
}

export function write(dir: string, tree: Tree): void {
  for (const [path, source] of Object.entries(tree)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), source);
  }
}

/** The process env without vitest's variables and any `KEEL_*`, then `extra`. */
function cleanEnv(extra: Readonly<Record<string, string>>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

export type Run = { status: number | null; stdout: string; stderr: string };

/** `keel <args>` in `dir`; a real wait the build and the browser take, so its bound is fixed time. */
export function keel(
  dir: string,
  args: readonly string[],
  opts: { env?: Readonly<Record<string, string>>; format?: "compact" | "json"; ms?: number } = {},
): Run {
  const r = spawnSync(process.execPath, [BIN, ...args, `--format=${opts.format ?? "compact"}`], {
    cwd: dir,
    encoding: "utf8",
    env: cleanEnv(opts.env ?? {}),
    timeout: fixedTime(opts.ms ?? 540_000),
    killSignal: "SIGKILL",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** `keel test --e2e [paths]` in `dir`. */
export const keelE2e = (dir: string, paths: readonly string[] = [], opts: Parameters<typeof keel>[2] = {}): Run =>
  keel(dir, ["test", "--e2e", ...paths], opts);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export type Outcome = "passed" | "failed" | "skipped";
/** The state `reports/tests/e2e.json` holds for the test of `file` at `line`, or undefined. */
export function outcome(dir: string, file: string, line: number): Outcome | undefined {
  const path = join(dir, "reports", "tests", "e2e.json");
  if (!existsSync(path)) return undefined;
  const report: unknown = JSON.parse(readFileSync(path, "utf8"));
  const files = isRecord(report) && isRecord(report.files) ? report.files : {};
  const entry = files[file];
  const tests = isRecord(entry) && Array.isArray(entry.tests) ? entry.tests : [];
  for (const t of tests) {
    if (isRecord(t) && t.line === line && (t.state === "passed" || t.state === "failed" || t.state === "skipped"))
      return t.state;
  }
  return undefined;
}

/** `files` under `dir/<sub>`, relative, sorted; none when the folder is absent. */
export function listing(dir: string, sub: string): string[] {
  const root = join(dir, sub);
  if (!existsSync(root)) return [];
  return readdirSync(root).sort();
}

export const INNER_HEAD = "import { expect, it } from 'vitest'\n";
export type Inner = { readonly title: string; readonly body: string; readonly options?: string };
/**
 * The source of one e2e file holding `tests` (each an `it` of one line `it('<title>', async () => {`), its imports from `imports`
 * (a line each), and the 1-based line of each title, so a case finds its test in the report and its T0001 by line.
 */
export function suite(imports: readonly string[], tests: readonly Inner[]): { source: string; lines: Record<string, number> } {
  const lines: Record<string, number> = {};
  const out = [INNER_HEAD.trimEnd(), ...imports, ""];
  for (const t of tests) {
    lines[t.title] = out.length + 1;
    out.push(`it('${t.title}', async () => {`, ...t.body.split("\n").map((l) => `  ${l}`), `}${t.options ?? ""})`, "");
  }
  return { source: `${out.join("\n")}`, lines };
}

/** The T0001 line of `file` at `line` in compact output, with the indented lines under it; undefined when none. */
export function failureOf(stdout: string, file: string, line: number): string | undefined {
  const rows = stdout.split("\n");
  const at = rows.findIndex((r) => r.startsWith(`T0001 ${file}:${line}:`));
  if (at < 0) return undefined;
  const block = [rows[at] ?? ""];
  for (const r of rows.slice(at + 1)) {
    if (!r.startsWith("  ")) break;
    block.push(r);
  }
  return block.join("\n");
}
