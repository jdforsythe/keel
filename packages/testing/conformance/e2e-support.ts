import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { expect } from "vitest";
import type { Tree } from "./fixtures/e2e/node-app.ts";

export const SEED = 1337;
export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
export const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

/** Resolves `playwright-core` from the repo: the hoisted link when there is one, else the pnpm store's copy. */
function playwrightCore(): string | undefined {
  const hoisted = join(REPO, "node_modules", "playwright-core");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  if (!existsSync(store)) return undefined;
  const found = readdirSync(store).find((n) => n.startsWith("playwright-core@"));
  return found === undefined ? undefined : join(store, found, "node_modules", "playwright-core");
}

/** The workspace's `@types/node` (pnpm keeps it under `.pnpm/`): a fixture project links it so its build (E1751) resolves Node's types. */
function typesNode(): string | undefined {
  const hoisted = join(REPO, "node_modules", "@types", "node");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  if (!existsSync(store)) return undefined;
  const found = readdirSync(store)
    .filter((n) => n.startsWith("@types+node@"))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  return found === undefined ? undefined : join(store, found, "node_modules", "@types", "node");
}

export type Made = { dir: string };
const made: string[] = [];
/** Removes every project this file made; call it from `afterAll`. */
export const cleanup = (): void => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
};

/**
 * A project of `tree` in a new folder under the OS tmpdir with `@keel/*`, `vitest`, `vite`, `typescript` and `fast-check` linked, and,
 * unless `playwright` is false, `playwright-core` (absent from the project's resolution when false), and `@types/node`; the
 * `@keel/<name>` packages in `omit` are not linked (a library missing a package its host needs).
 */
export function project(tree: Tree, opts: { playwright?: boolean; omit?: readonly string[] } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-e2e-"));
  made.push(dir);
  write(dir, tree);
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    if (!(opts.omit ?? []).includes(pkg))
      symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules", "@keel", pkg));
  for (const name of ["vitest", "vite", "typescript", "fast-check", "happy-dom"]) {
    const from = join(REPO, "node_modules", name);
    if (existsSync(from)) symlinkSync(from, join(dir, "node_modules", name));
  }
  const types = typesNode();
  if (types !== undefined) {
    mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
    symlinkSync(types, join(dir, "node_modules", "@types", "node"));
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
export function cleanEnv(extra: Readonly<Record<string, string>>): Record<string, string> {
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
/** The state `reports/tests/<reportFile>` (default `e2e.json`) holds for the test of `file` at `line`, or undefined. */
export function outcome(dir: string, file: string, line: number, reportFile = "e2e.json"): Outcome | undefined {
  const path = join(dir, "reports", "tests", reportFile);
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
export function suite(
  imports: readonly string[],
  tests: readonly Inner[],
): { source: string; lines: Record<string, number> } {
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

/**
 * `test/support.ts` of a fixture project (a source text): `envOf` reads `GET /api/<module>/env` of a deployable from the test
 * process (the values its process holds), `alive` looks for a process by a word of its command line.
 */
export const SUPPORT_ENV = `import { spawnSync } from 'node:child_process'
import { connect } from 'node:net'
import { serve } from '@keel/testing/e2e'
export type Served = Awaited<ReturnType<typeof serve>>
export async function envOf(app: Served, deployable: string, mod = 'a'): Promise<Record<string, string>> {
  const res = await app.fetch(\`/api/\${mod}/env\`, { deployable, headers: { accept: 'application/json' } })
  const body: unknown = await res.json()
  const results = typeof body === 'object' && body !== null ? Reflect.get(body, 'results') : undefined
  const entry = typeof results === 'object' && results !== null ? Reflect.get(results, \`\${mod}.env\`) : undefined
  const value = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'value') : undefined
  if (typeof value !== 'object' || value === null) throw new Error('no env answer')
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]))
}
/** True when nothing accepts a connection at \`origin\`. */
export const refused = (origin: string): Promise<boolean> =>
  new Promise((resolve) => {
    const url = new URL(origin)
    const socket = connect(Number(url.port), url.hostname)
    socket.once('connect', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(true))
  })
export const alive = (needle: string): boolean => {
  const ps = spawnSync('ps', ['-A', '-o', 'command='], { encoding: 'utf8' })
  return ps.stdout.split('\\n').some((l) => l.includes(needle))
}
`;

/** `test/board.ts` of a module-`a` fixture project: the server store `a.board` the test hands to `state`, `until` and `log`, made in a scope (E1203) once. */
export const SUPPORT_BOARD = `import { scope } from '@keel/reactive'
import { boards } from '../modules/a/boards.ts'
let made: ReturnType<typeof boards>['board'] | undefined
export function board(): ReturnType<typeof boards>['board'] {
  if (made === undefined) made = scope(() => undefined).run(() => boards().board)
  return made
}
`;

/** The `Failure` shape a test reads a rejection into: its `code` and `message`. */
export const FAILURE = `export const failure = async (p: Promise<unknown>): Promise<{ code: unknown; message: string }> => {
  const e: unknown = await p.then(() => undefined, (x: unknown) => x)
  return { code: Reflect.get(Object(e), 'code'), message: String(Reflect.get(Object(e), 'message')) }
}
`;

/** What a failed case shows: the run's T0001 lines of the fixture's own files (each with its indented lines), else the tail of its output. */
export function reasons(r: Run | undefined): string {
  if (r === undefined) return "no run";
  const rows = r.stdout.split("\n");
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!(rows[i] ?? "").startsWith("T0001 test/")) continue;
    out.push(rows[i] ?? "");
    for (const n of rows.slice(i + 1)) {
      if (!n.startsWith("  ")) break;
      out.push(n);
    }
  }
  return out.length > 0 ? out.join("\n").slice(0, 4000) : `${r.stdout}\n${r.stderr}`.slice(-3000);
}

export type Job = {
  readonly key: string;
  readonly tree: Tree;
  readonly file: string;
  readonly source: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly omit?: readonly string[];
};
export type Ran = { dir: string; run: Run; file: string };

/**
 * Makes one project per job (a case on a verb the handle may lack is a type error, E1751, that fails its project's build and no other),
 * runs `keel test --e2e` over each and returns what ran by key. Every run's `KEEL_TEST_TIME_SCALE` is 1 unless the job sets it.
 */
export function runJobs(jobs: readonly Job[]): Map<string, Ran> {
  const out = new Map<string, Ran>();
  for (const j of jobs) {
    const dir = project({ ...j.tree, [j.file]: j.source }, { omit: j.omit ?? [] });
    out.set(j.key, {
      dir,
      run: keelE2e(dir, [], { env: { KEEL_TEST_TIME_SCALE: "1", ...(j.env ?? {}) } }),
      file: j.file,
    });
  }
  return out;
}

/** Asserts the fixture test at `line` of job `key` passed, with the run's own failure text as the message. */
export function passedJob(ran: ReadonlyMap<string, Ran>, key: string, line: number | undefined): void {
  const r = ran.get(key);
  expect(r, `job ${key} ran`).toBeDefined();
  expect(line, "the fixture test exists").toBeDefined();
  if (r === undefined) return;
  expect(outcome(r.dir, r.file, line ?? 0), reasons(r.run)).toBe("passed");
}

/**
 * `test/rows.ts` of a fixture project (a source text): the text of every value of a SQLite file's tables (`texts`), and the change of
 * one such value whose SHA-256 is `digest`, `from` replaced by `to` (`changeRow`: true when a row was changed). It reads the storage
 * file as bytes the test owns and takes no table or key name from the product.
 */
export const SUPPORT_ROWS = `import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
const sha = (t: string): string => createHash('sha256').update(t).digest('hex')
const text = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v instanceof Uint8Array ? Buffer.from(v).toString('utf8') : undefined
function tables(db: DatabaseSync): string[] {
  const names: string[] = []
  for (const row of db.prepare("select name from sqlite_master where type = 'table'").all()) {
    const name = row.name
    if (typeof name === 'string') names.push(name)
  }
  return names
}
export function texts(path: string): string[] {
  const db = new DatabaseSync(path, { readOnly: true })
  const out: string[] = []
  for (const t of tables(db))
    for (const row of db.prepare(\`select * from "\${t}"\`).all())
      for (const v of Object.values(row)) {
        const s = text(v)
        if (s !== undefined) out.push(s)
      }
  db.close()
  return out
}
export function changeRow(path: string, digest: string, from: string, to: string): boolean {
  const db = new DatabaseSync(path)
  let changed = false
  for (const t of tables(db))
    for (const row of db.prepare(\`select rowid as rid, * from "\${t}"\`).all())
      for (const [column, v] of Object.entries(row)) {
        const s = text(v)
        if (changed || column === 'rid' || s === undefined || sha(s) !== digest) continue
        const rid = typeof row.rid === 'number' || typeof row.rid === 'bigint' ? row.rid : 0
        db.prepare(\`update "\${t}" set "\${column}" = ? where rowid = ?\`).run(typeof v === 'string' ? s.replace(from, to) : Buffer.from(s.replace(from, to)), rid)
        changed = true
      }
  db.close()
  return changed
}
`;
