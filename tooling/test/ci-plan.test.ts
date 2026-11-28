import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  asTimes,
  deal,
  label,
  mergeTimes,
  parseShardLog,
  partSeconds,
  splitFiles,
  type Times,
  units,
} from "../ci-plan.ts";

const times = (over: Partial<Times> = {}): Times => ({ runs: [], packages: {}, files: {}, parallel: {}, ...over });

describe("splitFiles", () => {
  it("deals files heaviest first to the lightest part, so one slow file stands alone", () => {
    const seconds = { "a.test.ts": 100, "b.test.ts": 40, "c.test.ts": 30, "d.test.ts": 20, "e.test.ts": 10 };
    expect(splitFiles(Object.keys(seconds), seconds, 2)).toEqual([
      ["a.test.ts"],
      ["b.test.ts", "c.test.ts", "d.test.ts", "e.test.ts"],
    ]);
  });
  it("weighs a file no run recorded as the mean of the recorded ones", () => {
    const seconds = { "a.test.ts": 30, "b.test.ts": 10 };
    // new.test.ts weighs 20: after a (30) and b (10) it goes to b's part.
    expect(splitFiles(["new.test.ts", "a.test.ts", "b.test.ts"], seconds, 2)).toEqual([
      ["a.test.ts"],
      ["b.test.ts", "new.test.ts"],
    ]);
  });
  it("puts every file in exactly one part, the same parts for any order of the same files", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}\.test\.ts$/), { maxLength: 40 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 1000 }),
        (files, parts, seed) => {
          const seconds = Object.fromEntries(files.filter((_, i) => i % 3 !== 0).map((f, i) => [f, (i * seed) % 97]));
          const split = splitFiles(files, seconds, parts);
          expect(split).toHaveLength(parts);
          expect(split.flat().sort()).toEqual([...files].sort());
          expect(splitFiles([...files].reverse(), seconds, parts)).toEqual(split);
        },
      ),
      { seed: 9631, numRuns: 200 },
    );
  });
});

describe("partSeconds", () => {
  it("is the files' sum times the parallel factor, never under the slowest file", () => {
    const seconds = { a: 100, b: 100, c: 900 };
    expect(partSeconds(["a", "b"], seconds, 0.5)).toBe(100);
    expect(partSeconds(["a", "b", "c"], seconds, 0.5)).toBe(900);
    expect(partSeconds([], seconds, 0.5)).toBe(0);
  });
});

describe("units and deal", () => {
  const tasks = [
    { name: "big", dir: "packages/big", files: ["a", "b", "c", "d"] },
    { name: "mid", dir: "packages/mid", testFiles: 3 },
    { name: "new", dir: "packages/new", testFiles: 2 },
  ];
  const t = times({
    packages: { mid: 50 },
    files: { big: { a: 80, b: 60, c: 40, d: 20 } },
    parallel: { big: 0.5 },
  });
  it("weighs a whole package by its recorded seconds, an unrecorded one by its files, a split one by its parts", () => {
    expect(units(tasks, t, { big: 2 }).map((u) => [label(u), u.w])).toEqual([
      ["big 1/2", 80],
      ["big 2/2", 60],
      ["mid", 50],
      ["new", 10],
    ]);
  });
  it("deals units heaviest first to the lightest shard, never two parts of one package together", () => {
    const shards = deal(units(tasks, t, { big: 2 }), 2);
    expect(shards.map((s) => [s.seconds, s.units.map(label)])).toEqual([
      [90, ["big 1/2", "new"]],
      [110, ["big 2/2", "mid"]],
    ]);
  });
  it("places every unit in exactly one shard, and the shards' seconds add up to the units'", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 1, max: 10 }),
        (ws, n) => {
          const all = ws.map((w, i) => ({ name: `p${i}`, part: 1, parts: 1, w }));
          const shards = deal(all, n);
          expect(shards.flatMap((s) => s.units.map(label)).sort()).toEqual(all.map(label).sort());
          expect(shards.reduce((a, s) => a + s.seconds, 0)).toBe(ws.reduce((a, b) => a + b, 0));
        },
      ),
      { seed: 9632, numRuns: 200 },
    );
  });
});

const LOG = [
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:24:30.0000000Z run @keel/cli 4/4 test",
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:24:39.0000000Z @keel/cli:test: file test/a.test.ts 6.4s",
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:25:58.0000000Z @keel/cli:test: file conformance/b.test.ts 78.7s",
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:26:10.0000000Z run @keel/std-db test",
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:26:40.0000000Z run @keel/std-postgres test",
  "test-shard (5)\tRun node tooling/ci-shards.mjs 5\t2026-11-28T11:27:40.0000000Z @keel/std-postgres:test: still",
].join("\n");

describe("parseShardLog", () => {
  it("times a task the job cut from its run line to the log's end, and the others to the next run line", () => {
    expect(parseShardLog(LOG)).toEqual({
      tasks: {
        "@keel/cli 4/4": { seconds: 100, cut: false },
        "@keel/std-db": { seconds: 30, cut: false },
        "@keel/std-postgres": { seconds: 60, cut: true },
      },
      files: { "@keel/cli": { "test/a.test.ts": 6.4, "conformance/b.test.ts": 78.7 } },
    });
  });
  it("takes a task's closing line over its run lines", () => {
    const closing = `${LOG}\ntest-shard (5)\tRun\t2026-11-28T11:30:00.0000000Z ok @keel/std-db test 28.5s, peak 1.0 GB`;
    expect(parseShardLog(closing).tasks["@keel/std-db"]).toEqual({ seconds: 28.5, cut: false });
  });
});

describe("mergeTimes", () => {
  it("keeps the most any run took and the highest parallel factor of a finished part", () => {
    const a = parseShardLog(LOG);
    const b = {
      tasks: { "@keel/std-db": { seconds: 44.2, cut: false }, "@keel/cli 1/4": { seconds: 10, cut: false } },
      files: { "@keel/cli": { "test/a.test.ts": 9, "test/c.test.ts": 1 } },
    };
    expect(mergeTimes(["1", "2"], [a, b])).toEqual({
      runs: ["1", "2"],
      packages: { "@keel/std-db": 45, "@keel/std-postgres": 60 },
      files: { "@keel/cli": { "conformance/b.test.ts": 78.7, "test/a.test.ts": 9, "test/c.test.ts": 1 } },
      parallel: { "@keel/cli": 1.18 },
    });
  });
  it("round-trips through asTimes, which refuses a malformed table", () => {
    const merged = mergeTimes(["1"], [parseShardLog(LOG)]);
    expect(asTimes(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
    expect(() => asTimes({ runs: [], packages: { x: "1" }, files: {}, parallel: {} })).toThrow(/times.packages.x/);
  });
});
