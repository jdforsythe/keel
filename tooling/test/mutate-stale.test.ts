import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mutationUnits, unitDir } from "../mutate-units.mjs";
import { chunkPlan, endLine, leftLine, listLine, positive, staleFiles } from "../mutate-stale-plan.mjs";

const shas = new Map([
  ["packages/a/src/x.ts", "1"],
  ["packages/a/src/y.ts", "2"],
  ["packages/a/src/index.ts", "9"],
  ["packages/a/src/types/t.ts", "9"],
  ["packages/b/src/z.ts", "3"],
  ["packages/b/src/deep/w.ts", "4"],
]);

describe("staleFiles", () => {
  it("splits files into stale (another sha) and missing (no claim), leaving fresh ones out", () => {
    const claims = [
      { file: "packages/a/src/x.ts", sha: "1" },
      { file: "packages/a/src/y.ts", sha: "old" },
      { file: "packages/b/src/z.ts", sha: "3" },
    ];
    expect(staleFiles(claims, shas, ["a", "b"])).toEqual([
      { pkg: "a", stale: ["src/y.ts"], missing: [] },
      { pkg: "b", stale: [], missing: ["src/deep/w.ts"] },
    ]);
  });
  it("skips index.ts, types/ and packages not asked for", () => {
    expect(staleFiles([], shas, ["a"])).toEqual([{ pkg: "a", stale: [], missing: ["src/x.ts", "src/y.ts"] }]);
  });
  it("ignores claims of files no longer on disk", () => {
    expect(staleFiles([{ file: "packages/a/src/gone.ts", sha: "1" }], new Map(), ["a"])).toEqual([]);
  });
});

describe("staleFiles for an app", () => {
  const appShas = new Map([
    ["apps/g/modules/todos/a.ts", "1"],
    ["apps/g/modules/index.ts", "9"],
    ["apps/g/modules/types/t.ts", "9"],
    ["apps/g/src/b.ts", "2"],
    ["packages/a/src/x.ts", "3"],
  ]);
  it("reads an app's modules folder under `apps/`, and a package's src beside it", () => {
    expect(staleFiles([{ file: "apps/g/modules/todos/a.ts", sha: "old" }], appShas, ["a", "apps/g"])).toEqual([
      { pkg: "a", stale: [], missing: ["src/x.ts"] },
      { pkg: "apps/g", stale: ["modules/todos/a.ts"], missing: [] },
    ]);
  });
});

describe("mutationUnits", () => {
  it("lists packages by name and apps as apps/<name>, those with a Stryker config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-units-"));
    try {
      for (const d of ["packages/p", "packages/q", "apps/g", "apps/h"])
        fs.mkdirSync(path.join(dir, d), { recursive: true });
      for (const d of ["packages/p", "apps/g"]) fs.writeFileSync(path.join(dir, d, "stryker.config.mjs"), "");
      expect(mutationUnits(dir)).toEqual(["p", "apps/g"]);
      expect(unitDir("p")).toBe("packages/p");
      expect(unitDir("apps/g")).toBe("apps/g");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("chunkPlan", () => {
  const entries = [
    { pkg: "a", stale: ["1", "2", "3"], missing: ["m"] },
    { pkg: "b", stale: [], missing: ["n"] },
  ];
  it("cuts each package's stale files into chunks and leaves missing ones out by default", () => {
    expect(chunkPlan(entries, 2)).toEqual([
      { pkg: "a", files: ["1", "2"] },
      { pkg: "a", files: ["3"] },
    ]);
  });
  it("adds the missing files on request", () => {
    expect(chunkPlan(entries, 4, { missing: true })).toEqual([
      { pkg: "a", files: ["1", "2", "3", "m"] },
      { pkg: "b", files: ["n"] },
    ]);
  });
  it("treats a size below one as one", () => {
    expect(chunkPlan(entries, 0)).toHaveLength(3);
  });
  it("keeps every file once, in order, in chunks no larger than the size", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.string(), { maxLength: 12 }), { maxLength: 5 }),
        fc.integer({ min: 1, max: 6 }),
        (lists, size) => {
          const entries = lists.map((stale, i) => ({ pkg: `p${i}`, stale, missing: [] }));
          const chunks = chunkPlan(entries, size);
          expect(chunks.every((c) => c.files.length >= 1 && c.files.length <= size)).toBe(true);
          expect(chunks.flatMap((c) => c.files.map((f) => `${c.pkg}:${f}`))).toEqual(
            entries.flatMap((e) => e.stale.map((f) => `${e.pkg}:${f}`)),
          );
        },
      ),
    );
  });
});

describe("lines", () => {
  const chunks = [
    { pkg: "a", files: ["1", "2"] },
    { pkg: "a", files: ["3"] },
    { pkg: "b", files: ["4"] },
  ];
  it("says what is left", () => {
    expect(leftLine(chunks)).toBe("4 files left in 2 packages");
    expect(leftLine(chunks.slice(2))).toBe("1 file left in 1 package");
    expect(leftLine([])).toBe("0 files left in 0 packages");
  });
  it("lists files and chunks per package", () => {
    expect(listLine(chunks)).toBe("a(3 files, 2 chunks),b(1 files, 1 chunks)");
    expect(listLine([])).toBe("none");
  });
});

describe("positive", () => {
  it("takes a positive integer, else the fallback", () => {
    expect(positive("5", 3)).toBe(5);
    for (const bad of [undefined, "0", "-1", "x", "1.5"]) expect(positive(bad, 3)).toBe(3);
  });
});

describe("endLine", () => {
  const left = [{ pkg: "a", files: ["src/x.ts"] }];
  it("ends ok on a clean run", () => {
    expect(endLine({ exit: 0, signalled: false, left })).toEqual({
      exit: 0,
      line: "ok mutate-stale 1 file left in 1 package; run again to resume",
    });
  });
  it("exits 130 and does not read ok after a signal", () => {
    const end = endLine({ exit: 0, signalled: true, left });
    expect(end.exit).toBe(130);
    expect(end.line.startsWith("stopped ")).toBe(true);
  });
  it("exits 130 with stopped when a stop file was seen between chunks", () => {
    const end = endLine({ exit: 0, signalled: false, stopped: true, left });
    expect(end.exit).toBe(130);
    expect(end.line.startsWith("stopped ")).toBe(true);
  });
  it("reports fail for another non-zero exit, and stopped for a runner's 130", () => {
    expect(endLine({ exit: 1, signalled: false, left }).line.startsWith("fail ")).toBe(true);
    expect(endLine({ exit: 130, signalled: false, left }).line.startsWith("stopped ")).toBe(true);
  });
});
