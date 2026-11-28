import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  globToRegExp,
  mergeReports,
  mutatedFiles,
  parseShard,
  readParts,
  shardArg,
  shardFiles,
  shardOf,
} from "../mutate-shard.mjs";

const pathArb = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,8}$/), { minLength: 1, maxLength: 4 })
  .map((parts) => `src/${parts.join("/")}.ts`);

describe("shardOf", () => {
  it("puts every file in exactly one shard of 1..N", () => {
    fc.assert(
      fc.property(fc.uniqueArray(pathArb, { maxLength: 40 }), fc.integer({ min: 1, max: 12 }), (files, n) => {
        const slices = Array.from({ length: n }, (_, k) => shardFiles(files, k + 1, n));
        expect(slices.flat().sort()).toEqual([...files].sort());
        for (const f of files) expect(slices.filter((s) => s.includes(f))).toHaveLength(1);
      }),
      { numRuns: 100, seed: 1337 },
    );
  });
  it("is the same on every run: a fixed hash of the path", () => {
    expect([shardOf("src/check.ts", 8), shardOf("src/rules/blankLabel.ts", 8)]).toEqual([
      shardOf("src/check.ts", 8),
      shardOf("src/rules/blankLabel.ts", 8),
    ]);
    expect(shardOf("src/check.ts", 1)).toBe(1);
    // Pinned values: a change to the hash would move files between shards and their caches.
    expect([shardOf("src/a.ts", 8), shardOf("src/b.ts", 8), shardOf("src/rules/x.ts", 8)]).toEqual([4, 2, 4]);
  });
});

describe("parseShard and shardArg", () => {
  it("reads i/N with 1 <= i <= N", () => {
    expect(parseShard("3/8")).toEqual({ i: 3, n: 8 });
    expect(parseShard("0/8")).toBeUndefined();
    expect(parseShard("9/8")).toBeUndefined();
    expect(parseShard("x")).toBeUndefined();
  });
  it("takes --shard from the args or KEEL_MUTATE_SHARD and leaves the rest", () => {
    expect(shardArg(["--shard", "2/4", "--force"], {})).toEqual({ rest: ["--force"], shard: { i: 2, n: 4 } });
    expect(shardArg(["--shard=1/2"], {})).toEqual({ rest: [], shard: { i: 1, n: 2 } });
    expect(shardArg([], { KEEL_MUTATE_SHARD: "4/4" })).toEqual({ rest: [], shard: { i: 4, n: 4 } });
    expect(shardArg([], {})).toEqual({ rest: [] });
    expect(shardArg(["--shard", "5/4"], {}).error).toMatch(/i\/N/);
  });
});

describe("globToRegExp and mutatedFiles", () => {
  it("matches Stryker's globs: ** spans directories, * does not", () => {
    const r = globToRegExp("src/**/*.ts");
    expect(["src/a.ts", "src/x/y/b.ts"].every((f) => r.test(f))).toBe(true);
    expect(r.test("test/a.ts")).toBe(false);
    expect(globToRegExp("src/types/**").test("src/types/a/b.ts")).toBe(true);
    expect(globToRegExp("src/*.ts").test("src/x/a.ts")).toBe(false);
  });
  it("lists the files a positive glob names and no ! glob excludes", () => {
    const dir = tempDir("keel-shard-");
    for (const f of ["src/index.ts", "src/a.ts", "src/types/t.ts", "src/x/b.ts", "src/x/DATA.ts", "test/a.test.ts"]) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), "");
    }
    const globs = ["src/**/*.ts", "!src/index.ts", "!src/types/**", "!src/x/DATA.ts"];
    expect(mutatedFiles(dir, globs)).toEqual(["src/a.ts", "src/x/b.ts"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

const mutant = (id: string, status: string, coveredBy: string[]) => ({
  id,
  mutatorName: "BooleanLiteral",
  replacement: "false",
  status,
  coveredBy,
  killedBy: status === "Killed" ? coveredBy.slice(0, 1) : undefined,
  location: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
});

describe("mergeReports", () => {
  const n = 2;
  const own = (i: number) => ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"].filter((f) => shardOf(f, n) === i);
  const part = (i: number, testNames: string[]) => {
    const files: Record<string, unknown> = {};
    // Every part also carries every file, as a shard's report does with results kept from its cache.
    for (const f of ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"])
      files[f] = { language: "typescript", source: `// ${f} from ${i}`, mutants: [mutant("0", "Killed", ["0"])] };
    return {
      i,
      n,
      report: {
        schemaVersion: "1",
        thresholds: { high: 90, low: 70, break: 70 },
        files,
        testFiles: { "test/a.test.ts": { tests: testNames.map((name, k) => ({ id: String(k), name })) } },
      },
    };
  };

  it("takes each file from the shard that owns it", () => {
    const { report, missing } = mergeReports([part(2, ["x", "y"]), part(1, ["y"])]);
    expect(missing).toEqual([]);
    for (let i = 1; i <= n; i++) for (const f of own(i)) expect(report.files[f].source).toBe(`// ${f} from ${i}`);
    expect(Object.keys(report.files)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"]);
  });

  it("merges tests by file and name and renames the mutants' ids to match", () => {
    const { report } = mergeReports([part(1, ["y"]), part(2, ["x", "y"])]);
    expect(report.testFiles["test/a.test.ts"].tests).toEqual([
      { id: "0", name: "y" },
      { id: "1", name: "x" },
    ]);
    // Shard 2's test "0" is "x", merged id "1".
    for (const f of own(2)) expect(report.files[f].mutants[0].coveredBy).toEqual(["1"]);
    for (const f of own(1)) expect(report.files[f].mutants[0].coveredBy).toEqual(["0"]);
  });

  it("names the shards that wrote no report", () => {
    expect(mergeReports([part(1, [])]).missing).toEqual([2]);
    expect(() => mergeReports([])).toThrow();
  });

  it("reads parts from <name>-shard-<i>-of-<N>/mutation.json", () => {
    const dir = tempDir("keel-merge-");
    const p = part(2, ["x"]);
    fs.mkdirSync(path.join(dir, "mutation-check-shard-2-of-2"));
    fs.writeFileSync(path.join(dir, "mutation-check-shard-2-of-2", "mutation.json"), JSON.stringify(p.report));
    fs.mkdirSync(path.join(dir, "mutation-cli"));
    expect(readParts(dir).map((x) => [x.i, x.n])).toEqual([[2, 2]]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
