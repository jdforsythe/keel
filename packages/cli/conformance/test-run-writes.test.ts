// Spec: k.test-run, clause "`keel test` over a project whose `test/a.test.ts` holds a passing test at line 3, a failing one at line 6 and an `it.skip` at line 9 writes `reports/tests/run.json` holding `test/a.test.ts` with the SHA-256 of its source and the tests `{ line: 3, state: 'passed' }`, `{ line: 6, state: 'failed' }` and `{ line: 9, state: 'skipped' }`, and no other file in `reports/tests/`."
// Spec: k.test-run, clause "In a git checkout of a project whose `.keel/` files `keel build` wrote, with `reports/` ignored, `git status --porcelain` prints nothing after `keel test`."
// Pending (rfc:0235 step 5; the git case waits for step 6, backlog 0999): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
// Seed: 1337 (the one property, 4 runs). Binary runs: 1 `keel test` per case (2 for the edit case), 1 per property run, and for the git case 1 `keel build` and 1 `keel test`.
// The real `keel` binary over temp projects (OS tmpdir; no vitest config: vitest's defaults). The git case builds golden-free `staticTree()` (static-support.ts), commits what `keel build`
// wrote (`.keel/` tracked, `node_modules`, `dist` and `reports` ignored) and gives it one test file that imports a module page so the compiler plugin transforms app code during the run.
// The sharded names `<i>-of-<k>.json` are asserted where `writeTestReport` is called with a shard (packages/testing/conformance/test-run-report.test.ts); `keel test` takes no shard here.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { keel as keelCompat, materialize } from "./compat-support.ts";
import { sha256 } from "./ledger-items-support.ts";
import { staticTree } from "./static-support.ts";
import { keel, makeProject, removeProject, writeFiles } from "./test-sim-project.ts";

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

/** A test file whose passing test is at line 3, whose failing one is at line 6 and whose `it.skip` is at line 9. */
const A_TEST = [
  'import { expect, it } from "vitest";',
  "",
  'it("passes", () => {',
  "  expect(1).toBe(1);",
  "});",
  'it("fails", () => {',
  "  expect(1).toBe(2);",
  "});",
  'it.skip("skipped", () => {});',
  "",
].join("\n");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const reportDir = (dir: string): string[] =>
  existsSync(join(dir, "reports/tests")) ? readdirSync(join(dir, "reports/tests")).sort() : [];
const runJson = (dir: string): string => readFileSync(join(dir, "reports/tests/run.json"), "utf8");

describe("k.test-run: a test run writes under `reports/` only", () => {
  // Pending (rfc:0235 step 5; the git case waits for step 6): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
  it.skip(
    "`keel test` over a project whose `test/a.test.ts` holds a passing test at line 3, a failing one at line 6 and an `it.skip` at line 9 writes `reports/tests/run.json` holding `test/a.test.ts` with the SHA-256 of its source and the tests `{ line: 3, state: 'passed' }`, `{ line: 6, state: 'failed' }` and `{ line: 9, state: 'skipped' }`, and no other file in `reports/tests/`",
    () => {
      const dir = project("test-run-writes", { "test/a.test.ts": A_TEST });
      const run = keel(dir, ["test"]);
      expect(run.status).toBe(1);
      expect(reportDir(dir)).toEqual(["run.json"]);
      const expected = {
        v: 1,
        files: {
          "test/a.test.ts": {
            sha: sha256(A_TEST),
            tests: [
              { line: 3, state: "passed" },
              { line: 6, state: "failed" },
              { line: 9, state: "skipped" },
            ],
          },
        },
      };
      // as `JSON.stringify(value, null, 2)` and a line feed
      expect(runJson(dir)).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    },
    SLOW,
  );

  it.skip(
    "a run holds one entry per test file it collected, its path relative to the project, and a run after an edit holds the edited file's new `sha`",
    () => {
      const other = 'import { expect, it } from "vitest";\nit("b", () => {\n  expect(2).toBe(2);\n});\n';
      const dir = project("test-run-entries", { "test/a.test.ts": A_TEST, "test/sub/b.test.ts": other });
      keel(dir, ["test"]);
      const report: unknown = JSON.parse(runJson(dir));
      const files = isRecord(report) && isRecord(report.files) ? report.files : {};
      expect(Object.keys(files).sort()).toEqual(["test/a.test.ts", "test/sub/b.test.ts"]);
      expect(files["test/sub/b.test.ts"]).toEqual({ sha: sha256(other), tests: [{ line: 2, state: "passed" }] });
      const edited = `${other}// edited\n`;
      writeFiles(dir, { "test/sub/b.test.ts": edited });
      keel(dir, ["test"]);
      expect(runJson(dir)).toContain(sha256(edited));
      expect(runJson(dir)).not.toContain(sha256(other));
    },
    SLOW,
  );

  it.skip(
    "an unsharded run removes the folder's other files: a stale `1-of-2.json` beside it is gone after `keel test`",
    () => {
      const dir = project("test-run-clears", {
        "test/a.test.ts": A_TEST,
        "reports/tests/1-of-2.json": '{ "v": 1, "files": {} }\n',
        "reports/tests/run.json": '{ "v": 1, "files": {} }\n',
      });
      keel(dir, ["test"]);
      expect(reportDir(dir)).toEqual(["run.json"]);
      expect(runJson(dir)).toContain("test/a.test.ts");
    },
    SLOW,
  );

  it.skip(
    "for any tests in a file, each test case is `{ line, state }` at its 1-based line, ordered by line, `passed`, `failed` or `skipped` as it ended (property)",
    () => {
      const kind = fc.constantFrom<"pass" | "fail" | "skip">("pass", "fail", "skip");
      fc.assert(
        fc.property(fc.array(kind, { minLength: 1, maxLength: 5 }), (kinds) => {
          const lines = ['import { expect, it } from "vitest";'];
          const at: number[] = [];
          for (const [i, k] of kinds.entries()) {
            lines.push("");
            at.push(lines.length + 1);
            if (k === "skip") lines.push(`it.skip("t${i}", () => {});`);
            else lines.push(`it("t${i}", () => { expect(1).toBe(${k === "pass" ? 1 : 2}); });`);
          }
          const source = `${lines.join("\n")}\n`;
          const dir = project("test-run-prop", { "test/p.test.ts": source });
          keel(dir, ["test"]);
          const state = { pass: "passed", fail: "failed", skip: "skipped" } as const;
          const expected = kinds.map((k, i) => ({ line: at[i], state: state[k] }));
          expect(JSON.parse(runJson(dir))).toEqual({
            v: 1,
            files: { "test/p.test.ts": { sha: sha256(source), tests: expected } },
          });
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW * 2,
  );

  it.skip(
    "In a git checkout of a project whose `.keel/` files `keel build` wrote, with `reports/` ignored, `git status --porcelain` prints nothing after `keel test`",
    () => {
      const tree = {
        ...staticTree(),
        ".gitignore": "node_modules\ndist\nreports\n",
        "test/page.test.ts":
          'import { expect, it } from "vitest";\nimport "../modules/s/Page.tsx";\nit("loads the page module", () => {\n  expect(1).toBe(1);\n});\n',
      };
      const dir = materialize(tree);
      made.push(dir);
      expect(keelCompat(dir, ["build"]).status).toBe(0);
      expect(existsSync(join(dir, ".keel"))).toBe(true);
      const git = (...args: string[]): string => {
        const r = spawnSync(
          "git",
          ["-c", "user.name=keel", "-c", "user.email=keel@example.com", "-c", "commit.gpgsign=false", ...args],
          {
            cwd: dir,
            encoding: "utf8",
          },
        );
        if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
        return r.stdout;
      };
      git("init", "-q");
      git("add", "-A");
      git("commit", "-q", "-m", "built");
      expect(git("ls-files")).toContain(".keel/");
      const tested = keel(dir, ["test"]);
      expect(tested.status).toBe(0);
      expect(existsSync(join(dir, "reports/tests/run.json"))).toBe(true);
      expect(git("status", "--porcelain")).toBe("");
    },
    SLOW,
  );
});
