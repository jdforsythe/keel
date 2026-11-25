// Spec: k.test-run, clause "`keel test` over a project whose `test/a.test.ts` holds one passing and one `it.skip` test and whose `test/b.test.ts` throws while loading has a summary with `tests` 3, `failed` 1 and `skipped` 1, and is not ok; `reports/tests/run.json` holds `test/b.test.ts` with `tests: []`."
// Pending (rfc:0235 step 5): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
// k.test-run Summary (a paragraph, not a clause): the summary counts `tests`, `failed` and `skipped` over the run report; the cases below assert it with the clause above.
// Seed: 1337 (the one property, 6 runs). Binary runs: 1 `keel test` per case, 1 per property run. The real `keel` binary over temp projects (OS tmpdir); no vitest config unless the case writes one.
// ASSUMED: a count the summary leaves out reads as 0; the compact line opens `ok test 0 tests` (the binary's default output when stdout is not a terminal; zero counts may follow it, as in `, 0 failed`).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type CliRecord, type Run, keel, makeProject, removeProject, root, summaryOf } from "./test-sim-project.ts";

const SEED = 1337;
const SLOW = 240_000;
const made: string[] = [];
afterAll(() => {
  for (const d of made) removeProject(d);
});
const project = (prefix: string, files: Record<string, string>): string => {
  const dir = makeProject(prefix, files);
  made.push(dir);
  return dir;
};

const PASS = 'import { expect, it } from "vitest";\nit("passes", () => {\n  expect(1).toBe(1);\n});\n';
const FAIL = 'import { expect, it } from "vitest";\nit("fails", () => {\n  expect(1).toBe(2);\n});\n';
const SKIP = 'import { it } from "vitest";\nit.skip("skipped", () => {});\n';
const BROKEN = "throw new Error('does not load');\n";
const EMPTY = 'import { it } from "vitest";\nvoid it;\n';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
/** A count of the summary; a key the summary leaves out (a zero count may be left out) reads as 0. */
const count = (run: Run, key: string): number => {
  const counts = summaryOf(run)?.counts;
  const v = isRecord(counts) ? counts[key] : undefined;
  return typeof v === "number" ? v : 0;
};
const okOf = (run: Run): unknown => summaryOf(run)?.ok;
const reportOf = (dir: string): Record<string, { tests: { state: string }[] }> => {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, "reports/tests/run.json"), "utf8"));
  const files = isRecord(parsed) && isRecord(parsed.files) ? parsed.files : {};
  return Object.fromEntries(
    Object.entries(files).map(([path, f]) => {
      const tests =
        isRecord(f) && Array.isArray(f.tests) ? f.tests.filter(isRecord).map((t) => ({ state: String(t.state) })) : [];
      return [path, { tests }];
    }),
  );
};

describe("k.test-run: the summary of `keel test` counts over the run report", () => {
  // Pending (rfc:0235 step 5): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
  it.skip(
    "`keel test` over a project whose `test/a.test.ts` holds one passing and one `it.skip` test and whose `test/b.test.ts` throws while loading has a summary with `tests` 3, `failed` 1 and `skipped` 1, and is not ok; `reports/tests/run.json` holds `test/b.test.ts` with `tests: []`",
    () => {
      const a =
        'import { expect, it } from "vitest";\nit("passes", () => {\n  expect(1).toBe(1);\n});\nit.skip("skipped", () => {});\n';
      const dir = project("test-run-sum", { "test/a.test.ts": a, "test/b.test.ts": BROKEN });
      const run = keel(dir, ["test"]);
      expect({ tests: count(run, "tests"), failed: count(run, "failed"), skipped: count(run, "skipped") }).toEqual({
        tests: 3,
        failed: 1,
        skipped: 1,
      });
      expect(okOf(run)).toBe(false);
      expect(run.status).toBe(1);
      expect(reportOf(dir)["test/b.test.ts"]).toEqual({ tests: [] });
    },
    SLOW,
  );

  it.skip(
    "a file that holds no test is one failed test, as one that fails to load is: `tests` 1, `failed` 1, and its report entry is `tests: []`",
    () => {
      const dir = project("test-run-empty", { "test/e.test.ts": EMPTY });
      const run = keel(dir, ["test"]);
      expect({ tests: count(run, "tests"), failed: count(run, "failed") }).toEqual({ tests: 1, failed: 1 });
      expect(okOf(run)).toBe(false);
      expect(reportOf(dir)["test/e.test.ts"]).toEqual({ tests: [] });
    },
    SLOW,
  );

  it.skip(
    "a skipped test counts in `tests` and in `skipped`, and a run of passing and skipped tests only is ok",
    () => {
      const dir = project("test-run-skipped", { "test/a.test.ts": PASS, "test/s.test.ts": SKIP });
      const run = keel(dir, ["test"]);
      expect({ tests: count(run, "tests"), failed: count(run, "failed"), skipped: count(run, "skipped") }).toEqual({
        tests: 2,
        failed: 0,
        skipped: 1,
      });
      expect(okOf(run)).toBe(true);
      expect(run.status).toBe(0);
    },
    SLOW,
  );

  it.skip(
    "with no test file and no vitest config, `keel test` runs nothing, writes no report and prints `ok test 0 tests`",
    () => {
      const dir = project("test-run-nothing", { "README.md": "no tests here\n" });
      const r = spawnSync(process.execPath, [join(root, "packages", "cli", "src", "bin.ts"), "test"], {
        cwd: dir,
        encoding: "utf8",
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([k, v]) => v !== undefined && !k.startsWith("VITEST") && !k.startsWith("KEEL_"),
          ),
        ),
      });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^ok test 0 tests\b/m);
      expect(existsSync(join(dir, "reports"))).toBe(false);
    },
    SLOW,
  );

  it.skip(
    "with a vitest config and no test file it is one T0001 `no test ran: vitest ended the run as failed`, and the run is not ok",
    () => {
      const dir = project("test-run-config-only", { "vitest.config.ts": "export default {};\n" });
      const run = keel(dir, ["test"]);
      const t0001 = run.records.filter((r): r is CliRecord => r.kind === "diag" && r.code === "T0001");
      expect(t0001).toHaveLength(1);
      expect(t0001[0]?.message).toBe("no test ran: vitest ended the run as failed");
      expect(okOf(run)).toBe(false);
      expect(run.status).toBe(1);
    },
    SLOW,
  );

  it.skip(
    "for any mix of passing, failing, skipped, unloadable and empty files, `failed` never exceeds `tests`, the run is ok exactly when `failed` is 0, and the summary's counts are the run report's (property)",
    () => {
      const sources = { pass: PASS, fail: FAIL, skip: SKIP, broken: BROKEN, empty: EMPTY } as const;
      type Kind = keyof typeof sources;
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom<Kind>("pass", "fail", "skip", "broken", "empty"), { minLength: 1, maxLength: 5 }),
          (kinds) => {
            const files: Record<string, string> = {};
            kinds.forEach((k, i) => {
              files[`test/f${i}.test.ts`] = sources[k];
            });
            const dir = project("test-run-mix", files);
            const run = keel(dir, ["test"]);
            const tests = count(run, "tests");
            const failed = count(run, "failed");
            expect(failed).toBeLessThanOrEqual(tests);
            expect(okOf(run)).toBe(failed === 0);
            // the report's totals: each test of an entry, plus one per entry with `tests: []`; failed and skipped likewise
            const entries = Object.values(reportOf(dir));
            const empties = entries.filter((e) => e.tests.length === 0).length;
            const all = entries.flatMap((e) => e.tests);
            expect(tests).toBe(all.length + empties);
            expect(failed).toBe(all.filter((t) => t.state === "failed").length + empties);
            expect(count(run, "skipped")).toBe(all.filter((t) => t.state === "skipped").length);
            // and the same totals from what the files hold: every file holds one test, none or fails to load
            expect(tests).toBe(kinds.length);
            expect(failed).toBe(kinds.filter((k) => k === "fail" || k === "broken" || k === "empty").length);
            expect(count(run, "skipped")).toBe(kinds.filter((k) => k === "skip").length);
          },
        ),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW * 3,
  );
});
