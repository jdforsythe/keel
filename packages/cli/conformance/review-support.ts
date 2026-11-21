// Support for the `keel review` conformance tests (k.review, k.escapes). Not a test file.
// Each repository is a real git repository in the OS tmpdir with one commit per tree; author, committer and dates are
// fixed through the environment so shas and bytes repeat. The real `keel` binary runs over it. No network is involved.
// Fixture text a repository lint would flag lives under `unsafe/review-fixtures/` and is copied, never rewritten.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { root } from "./test-sim-project.ts";

export const SEED = 1337;
const BIN = join(root, "packages", "cli", "src", "bin.ts");
const FIXTURES = fileURLToPath(new URL("./unsafe/review-fixtures/", import.meta.url));

/** The text of a fixture file under `unsafe/review-fixtures/`. */
export const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

/** One commit's changes: path to text, or `null` to delete the path. */
export type Tree = Readonly<Record<string, string | null>>;
export type Repo = { readonly dir: string; readonly shas: readonly string[] };

export type Finding = {
  kind: "review";
  code: string;
  path: string;
  line: number;
  col: number;
  message: string;
  protection: string;
  opt: boolean;
  danger: string;
  novelty: string;
  loud: string;
  id: string;
  reason?: string;
};
export type Rec = { kind: string; [key: string]: unknown };
export type Out = { status: number | null; stdout: string; stderr: string; records: Rec[] };

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && "kind" in v;
export const isFinding = (r: Rec): r is Finding =>
  r.kind === "review" &&
  typeof r.code === "string" &&
  typeof r.path === "string" &&
  typeof r.line === "number" &&
  typeof r.col === "number" &&
  typeof r.message === "string" &&
  typeof r.protection === "string" &&
  typeof r.opt === "boolean" &&
  typeof r.danger === "string" &&
  typeof r.novelty === "string" &&
  typeof r.loud === "string" &&
  typeof r.id === "string";

/** The process env with Keel's and vitest's variables dropped, and no usable network. */
function env(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    out[k] = v;
  }
  return {
    ...out,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    ...extra,
  };
}

function git(dir: string, args: readonly string[], date: string): string {
  const r = spawnSync("git", [...args], {
    cwd: dir,
    encoding: "utf8",
    env: env({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }),
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

export function write(dir: string, tree: Tree): void {
  for (const [path, text] of Object.entries(tree)) {
    if (text === null) rmSync(join(dir, path), { force: true });
    else {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  }
}

/** A git repository with one commit per tree (changes applied in order); its working tree is the last commit. */
export function makeRepo(commits: readonly Tree[]): Repo {
  const dir = mkdtempSync(join(tmpdir(), "keel-review-"));
  git(dir, ["init", "-q", "-b", "main"], "2026-01-01T00:00:00Z");
  const shas: string[] = [];
  commits.forEach((tree, i) => {
    const date = `2026-01-0${i + 1}T00:00:00Z`;
    write(dir, tree);
    git(dir, ["add", "-A", "-f"], date);
    git(dir, ["commit", "-q", "--allow-empty", "-m", `c${i}`], date);
    shas.push(git(dir, ["rev-parse", "HEAD"], date));
  });
  return { dir, shas };
}

export const removeRepo = (repo: Repo): void => rmSync(repo.dir, { recursive: true, force: true });

/** Run the body over a repository built from `commits`; the repository is removed after. */
export function withRepo<T>(commits: readonly Tree[], body: (repo: Repo) => T): T {
  const repo = makeRepo(commits);
  try {
    return body(repo);
  } finally {
    removeRepo(repo);
  }
}

/** `<sha of commit from>..<sha of commit to>`. */
export const range = (repo: Repo, from: number, to: number): string => `${repo.shas[from]}..${repo.shas[to]}`;

/** The real `keel` binary in `cwd`; `format` json by default; proxies point at a closed port. */
export function keelRun(
  cwd: string,
  args: readonly string[],
  opts: { format?: "json" | "compact"; env?: Readonly<Record<string, string>> } = {},
): Out {
  const format = opts.format ?? "json";
  const offline = {
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "",
  };
  const r = spawnSync(process.execPath, [BIN, ...args, `--format=${format}`], {
    cwd,
    encoding: "utf8",
    env: env({ ...offline, ...opts.env }),
  });
  const records: Rec[] = [];
  if (format === "json")
    for (const line of r.stdout.split("\n")) {
      if (line.trim() === "") continue;
      const v: unknown = JSON.parse(line);
      if (isRecord(v)) records.push(v);
    }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, records };
}

/** `keel review <args>` in the repository's root. */
export const review = (repo: Repo, args: readonly string[], cwd?: string): Out =>
  keelRun(cwd ?? repo.dir, ["review", ...args]);

export const findings = (out: Out): Finding[] => out.records.filter(isFinding);
export const ofCode = (out: Out, code: string): Finding[] => findings(out).filter((f) => f.code === code);

/** The `summary` record's `counts` (ASSUMED keys `fail`, `warn`, `list`, `accepted`). */
export function counts(out: Out): { fail: number; warn: number; list: number; accepted: number } | undefined {
  const s = out.records.filter((r) => r.kind === "summary").at(-1);
  const c = s?.counts;
  if (!isBag(c)) return undefined;
  const get = (k: string): number => {
    const v = c[k];
    return typeof v === "number" ? v : Number.NaN;
  };
  return { fail: get("fail"), warn: get("warn"), list: get("list"), accepted: get("accepted") };
}
const isBag = (v: unknown): v is { [key: string]: unknown } => typeof v === "object" && v !== null;

/** The 1-based line of the first line of `source` containing `needle`. */
export const lineOf = (source: string, needle: string): number =>
  source.split("\n").findIndex((l) => l.includes(needle)) + 1;

/** A project at the git root: `topology.ts`, a root `package.json`, and one clean module file. */
export const PROJECT: Tree = {
  "topology.ts": "export default {};\n",
  "package.json": `${JSON.stringify({ name: "fx", private: true })}\n`,
  "modules/m/a.ts": "export const a = 1;\n",
};

/** The baseline file text for `entries`. */
export const baselineText = (entries: readonly { id: string; code: string; path: string; reason: string }[]): string =>
  `${JSON.stringify({ v: 1, accepted: entries })}\n`;
