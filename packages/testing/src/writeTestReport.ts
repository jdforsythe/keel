import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { TestRunReport } from "./types/TestRunReport.ts";
import type { TestShard } from "./types/TestShard.ts";

type Rec = Readonly<Record<string, unknown>>;
type State = TestRunReport["files"][string]["tests"][number]["state"];

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const SHARD = /^\d+-of-(\d+)\.json$/;

/** A test task's state in the report: vitest's result, else its mode when it was skipped; `undefined` when it did not run. */
function stateOf(task: Rec): State | undefined {
  const result = isRec(task.result) ? str(task.result.state) : undefined;
  if (result === "pass") return "passed";
  if (result === "fail") return "failed";
  if (result === "skip" || result === "todo" || task.mode === "skip" || task.mode === "todo") return "skipped";
  return undefined;
}

/** Each test case under `node`, in run order, with its location line (vitest's `includeTaskLocation`). */
function casesOf(node: unknown, out: { line: number; state: State }[]): void {
  if (!isRec(node)) return;
  if (node.type === "test" || node.type === "custom") {
    const line = isRec(node.location) ? node.location.line : undefined;
    const state = stateOf(node);
    if (typeof line === "number" && Number.isInteger(line) && line > 0 && state !== undefined)
      out.push({ line, state });
  }
  for (const t of Array.isArray(node.tasks) ? node.tasks : []) casesOf(t, out);
}

/** Removes the report files a write replaces: every other file without `shard`, else `run.json` and other counts' parts. */
function clear(dir: string, own: string, shard: TestShard | undefined): void {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names) {
    if (n === own) continue;
    const m = SHARD.exec(n);
    const gone = shard === undefined || n === "run.json" || (m?.[1] !== undefined && Number(m[1]) !== shard.count);
    if (gone) rmSync(join(dir, n), { recursive: true, force: true });
  }
}

/**
 * Writes a finished vitest run's report (k.test-run Run report) to `<root>/reports/tests/run.json`, or to
 * `<i>-of-<k>.json` given `shard` `{ index: i, count: k }`. `files` are vitest's collected file tasks
 * (`state.getFiles()`): one entry per file, keyed by its path relative to `root`, with the SHA-256 hex of its source
 * as read now and each test case vitest ran or skipped as `{ line, state }`, ordered by line, then as run. A file that
 * did not load, or holds no test, has `tests: []`; one whose source can no longer be read has no entry. Without
 * `shard` the folder's other files are removed; with one, `run.json` and each `*-of-<m>.json` whose `m` is not `k`.
 * Returns the report written.
 */
export function writeTestReport(root: string, files: readonly unknown[], shard?: TestShard): TestRunReport {
  const entries: [string, TestRunReport["files"][string]][] = [];
  for (const f of files) {
    if (!isRec(f)) continue;
    const abs = (isRec(f.file) ? str(f.file.filepath) : undefined) ?? str(f.filepath);
    if (abs === undefined) continue;
    let source: Buffer;
    try {
      source = readFileSync(abs);
    } catch {
      continue;
    }
    const path = (isAbsolute(abs) ? relative(root, abs) : abs).split("\\").join("/");
    const cases: { line: number; state: State }[] = [];
    for (const t of Array.isArray(f.tasks) ? f.tasks : []) casesOf(t, cases);
    // Array.prototype.sort is stable: equal lines keep the run's order.
    const tests = cases.sort((a, b) => a.line - b.line);
    entries.push([path, { sha: createHash("sha256").update(source).digest("hex"), tests }]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const report: TestRunReport = { v: 1, files: Object.fromEntries(entries) };
  const dir = join(root, "reports", "tests");
  const own = shard === undefined ? "run.json" : `${shard.index}-of-${shard.count}.json`;
  mkdirSync(dir, { recursive: true });
  clear(dir, own, shard);
  writeFileSync(join(dir, own), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
