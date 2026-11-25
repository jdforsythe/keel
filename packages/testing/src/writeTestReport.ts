import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { testRunReport } from "./testRunReport.ts";
import type { TestRunReport } from "./types/TestRunReport.ts";
import type { TestShard } from "./types/TestShard.ts";

const SHARD = /^\d+-of-(\d+)\.json$/;

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
 * `<i>-of-<k>.json` given `shard` `{ index: i, count: k }`: the report `testRunReport` makes of `files`. Without
 * `shard` the folder's other files are removed; with one, `run.json` and each `*-of-<m>.json` whose `m` is not `k`.
 * Returns the report written.
 */
export function writeTestReport(root: string, files: readonly unknown[], shard?: TestShard): TestRunReport {
  const report = testRunReport(root, files);
  const dir = join(root, "reports", "tests");
  const own = shard === undefined ? "run.json" : `${shard.index}-of-${shard.count}.json`;
  mkdirSync(dir, { recursive: true });
  clear(dir, own, shard);
  writeFileSync(join(dir, own), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
