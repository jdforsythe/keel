// Spec: k.test-run, clause "`writeTestReport` with `shard` `{ index: 1, count: 2 }` over a `reports/tests/` holding `run.json` and `1-of-3.json` leaves the folder holding `1-of-2.json` alone; then without `shard`, `run.json` alone."
// k.test-run Run report (a paragraph, not a clause): the shape of the report, the shard names and which files a write removes are asserted by the cases below beside the clause above.
// Seed: 1337 (the properties, 50 runs each: no binary, a temp folder per run).
// ASSUMED: "the folder's other files" is read as the report files (`run.json`, `<i>-of-<k>.json`); the spec says nothing of a file of another name. `files` is typed `unknown[]` here because the
// spec fixes no type for a finished run's files; the reading is vitest's `File` tasks (below).
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as testing from "@keel/testing";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";

const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const root = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "keel-test-report-"));
  made.push(dir);
  return dir;
};

type Shard = { index: number; count: number };
type Write = (root: string, files: readonly unknown[], shard?: Shard) => unknown;
const isWrite = (v: unknown): v is Write => typeof v === "function";
const candidate: unknown = Reflect.get(testing, "writeTestReport");
const write: Write = (r, files, shard) => {
  if (!isWrite(candidate)) throw new Error("@keel/testing exports no writeTestReport");
  return shard === undefined ? candidate(r, files) : candidate(r, files, shard);
};

// ASSUMED (the spec names the argument only as "a finished vitest run"): `files` are vitest's collected `File` tasks, as `testResults` reads them:
// `{ type: 'suite', name, filepath, mode, tasks, result }`, a test task `{ type: 'test', name, mode, location: { line, column }, result: { state } }`
// with `state` `pass`, `fail` or `skip`; a suite task may nest tests; `filepath` is absolute, under the root the report is written for.
type Task = Record<string, unknown>;
const testTask = (line: number, state: "pass" | "fail" | "skip"): Task => ({
  type: "test",
  name: `t${line}`,
  mode: state === "skip" ? "skip" : "run",
  location: { line, column: 1 },
  result: { state },
  tasks: [],
});
const suiteTask = (tasks: Task[]): Task => ({
  type: "suite",
  name: "s",
  mode: "run",
  tasks,
  result: { state: "pass" },
});
const fileTask = (rootDir: string, path: string, tasks: Task[], state: "pass" | "fail" = "pass"): Task => ({
  type: "suite",
  name: path,
  filepath: join(rootDir, path),
  mode: "run",
  tasks,
  result: state === "fail" ? { state: "fail", errors: [{ message: "does not load" }] } : { state: "pass" },
});
const put = (rootDir: string, path: string, source: string): void => {
  mkdirSync(dirname(join(rootDir, path)), { recursive: true });
  writeFileSync(join(rootDir, path), source);
};
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const folder = (rootDir: string): string[] => {
  try {
    return readdirSync(join(rootDir, "reports", "tests")).sort();
  } catch {
    return [];
  }
};
const seedFolder = (rootDir: string, names: readonly string[]): void => {
  for (const n of names) put(rootDir, `reports/tests/${n}`, '{ "v": 1, "files": {} }\n');
};

describe("k.test-run: `writeTestReport` writes a run's report into `<root>/reports/tests/`", () => {
  it("`writeTestReport` with `shard` `{ index: 1, count: 2 }` over a `reports/tests/` holding `run.json` and `1-of-3.json` leaves the folder holding `1-of-2.json` alone; then without `shard`, `run.json` alone", () => {
    const dir = root();
    seedFolder(dir, ["run.json", "1-of-3.json"]);
    write(dir, [], { index: 1, count: 2 });
    expect(folder(dir)).toEqual(["1-of-2.json"]);
    write(dir, []);
    expect(folder(dir)).toEqual(["run.json"]);
  });

  it("a shard write keeps the other shards of its own count and removes `run.json` and the shards of another count", () => {
    const dir = root();
    seedFolder(dir, ["run.json", "2-of-2.json", "1-of-3.json", "2-of-3.json"]);
    write(dir, [], { index: 1, count: 2 });
    expect(folder(dir)).toEqual(["1-of-2.json", "2-of-2.json"]);
  });

  it("for any shard and any report files already there, a shard write leaves the shard's own file and the other files of its count, and a write without `shard` leaves `run.json` alone (property)", () => {
    const names = fc.uniqueArray(
      fc.oneof(
        fc.constant("run.json"),
        fc.tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 })).map(([i, m]) => `${i}-of-${m}.json`),
      ),
      { maxLength: 8 },
    );
    fc.assert(
      fc.property(names, fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }), (prior, index, count) => {
        const dir = root();
        seedFolder(dir, prior);
        write(dir, [], { index, count });
        const own = `${index}-of-${count}.json`;
        const kept = prior.filter((n) => n.endsWith(`-of-${count}.json`));
        expect(folder(dir)).toEqual([...new Set([...kept, own])].sort());
        write(dir, []);
        expect(folder(dir)).toEqual(["run.json"]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("the report is `{ v: 1, files: { [path]: { sha, tests: [{ line, state }] } } }` as `JSON.stringify(value, null, 2)` and a line feed, one entry per test file the run collected, `path` relative to the root, `sha` the SHA-256 hex of the file's source", () => {
    const dir = root();
    const a = "// a\nit('x', () => {});\n";
    const b = "// b\n";
    put(dir, "test/a.test.ts", a);
    put(dir, "test/sub/b.test.ts", b);
    write(dir, [
      fileTask(dir, "test/a.test.ts", [testTask(2, "pass")]),
      fileTask(dir, "test/sub/b.test.ts", [testTask(5, "fail"), testTask(9, "skip")]),
    ]);
    const expected = {
      v: 1,
      files: {
        "test/a.test.ts": { sha: sha256(a), tests: [{ line: 2, state: "passed" }] },
        "test/sub/b.test.ts": {
          sha: sha256(b),
          tests: [
            { line: 5, state: "failed" },
            { line: 9, state: "skipped" },
          ],
        },
      },
    };
    expect(readFileSync(join(dir, "reports/tests/run.json"), "utf8")).toBe(`${JSON.stringify(expected, null, 2)}\n`);
  });

  it("a file that failed to load, or holds no test, holds `tests: []`", () => {
    const dir = root();
    put(dir, "test/broken.test.ts", "throw new Error('x');\n");
    put(dir, "test/empty.test.ts", "// nothing\n");
    write(dir, [fileTask(dir, "test/broken.test.ts", [], "fail"), fileTask(dir, "test/empty.test.ts", [])]);
    const report: unknown = JSON.parse(readFileSync(join(dir, "reports/tests/run.json"), "utf8"));
    expect(report).toEqual({
      v: 1,
      files: {
        "test/broken.test.ts": { sha: sha256("throw new Error('x');\n"), tests: [] },
        "test/empty.test.ts": { sha: sha256("// nothing\n"), tests: [] },
      },
    });
  });

  it("per test case vitest ran or skipped, in a suite or nested ones, `{ line, state }` ordered by line, then as run (property)", () => {
    const state = fc.constantFrom<"pass" | "fail" | "skip">("pass", "fail", "skip");
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 60 }), state), { minLength: 1, maxLength: 8 }),
        (cases) => {
          const dir = root();
          put(dir, "t.test.ts", "// t\n");
          const tasks = cases.map(([line, s]) => testTask(line, s));
          // the run's order is the generated one; the last half sits in a nested suite
          const half = Math.floor(tasks.length / 2);
          write(dir, [fileTask(dir, "t.test.ts", [...tasks.slice(0, half), suiteTask(tasks.slice(half))])]);
          const report: unknown = JSON.parse(readFileSync(join(dir, "reports/tests/run.json"), "utf8"));
          const word = { pass: "passed", fail: "failed", skip: "skipped" } as const;
          const expected = cases
            .map(([line, s], i) => ({ line, state: word[s], i }))
            .sort((x, y) => x.line - y.line || x.i - y.i)
            .map(({ line, state: st }) => ({ line, state: st }));
          expect(report).toEqual({ v: 1, files: { "t.test.ts": { sha: sha256("// t\n"), tests: expected } } });
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("a sharded write holds the same report as an unsharded one, under `<i>-of-<k>.json`", () => {
    const dir = root();
    put(dir, "test/a.test.ts", "// a\n");
    const files = [fileTask(dir, "test/a.test.ts", [testTask(2, "pass")])];
    write(dir, files);
    const whole = readFileSync(join(dir, "reports/tests/run.json"), "utf8");
    write(dir, files, { index: 2, count: 3 });
    expect(readFileSync(join(dir, "reports/tests/2-of-3.json"), "utf8")).toBe(whole);
  });
});
