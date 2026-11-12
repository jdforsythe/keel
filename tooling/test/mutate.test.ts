import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { changedScope, stopRequested } from "../mutate-changed.mjs";
import { budgetMinutes, ending, groupMembers, leftNote, statusLine } from "../mutate.mjs";
import { packageRelative, readTimes } from "../mutate-cache.ts";
import { quickFirstOrder } from "../quick-first.ts";

describe("budgetMinutes", () => {
  it("reads the package entry, else the default", () => {
    const budgets = { mutate: { default: 30, "@keel/check": 45 } };
    expect(budgetMinutes(budgets, "check")).toBe(45);
    expect(budgetMinutes(budgets, "ctx")).toBe(30);
  });
  it("refuses a missing or non-positive budget", () => {
    expect(() => budgetMinutes({}, "ctx")).toThrow(/mutate\.default/);
    expect(() => budgetMinutes({ mutate: { default: 0 } }, "ctx")).toThrow(/mutate\.default/);
  });
});

describe("statusLine", () => {
  it("counts the rate from mutants this run tested, not the reused ones", () => {
    const p = { total: 8634, reused: 3100, tested: 5120, startedAt: 0 };
    expect(statusLine("check", p, 20 * 60000)).toBe(
      "check 5,120 of 8,634 mutants, 3,100 reused, 101 a minute, about 35m left",
    );
  });
  it("has no estimate before the first tested mutant", () => {
    const p = { total: 10, reused: 4, tested: 4, startedAt: 0 };
    expect(statusLine("ctx", p, 1000)).toBe("ctx 4 of 10 mutants, 4 reused, 0 a minute, no rate yet");
  });
});

describe("ending", () => {
  it("names the budget first, then a stop, and anything else a crash", () => {
    expect(ending({ over: true, signalled: true, code: 130, signal: null })).toBe("budget");
    expect(ending({ over: false, signalled: true, code: 130, signal: null })).toBe("stopped");
    expect(ending({ over: false, signalled: false, code: null, signal: "SIGINT" })).toBe("stopped");
    expect(ending({ over: false, signalled: false, code: null, signal: "SIGKILL" })).toBe("crashed");
    expect(ending({ over: false, signalled: false, code: 1, signal: null })).toBe("crashed");
  });
});

describe("process groups", () => {
  it("lists the pids of one group from a ps listing", () => {
    const listing = "  101   100\n  102   100\n  200   200\n\n garbage\n  103   100\n";
    expect(groupMembers(listing, 100)).toEqual([101, 102, 103]);
    expect(groupMembers(listing, 300)).toEqual([]);
  });
  it("says whether any process of the group is left", () => {
    expect(leftNote([])).toBe("no process left");
    expect(leftNote([41])).toBe("1 process left (pids 41)");
    expect(leftNote([41, 42])).toBe("2 processes left (pids 41,42)");
  });
});

describe("stopRequested", () => {
  it("is false without a stop file, and for a stop older than the sequence", () => {
    expect(stopRequested("/nonexistent/stop.json", 0)).toBe(false);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-stop-"));
    try {
      const file = path.join(dir, "stop.json");
      fs.writeFileSync(file, JSON.stringify({ at: 1000 }));
      expect(stopRequested(file, 500)).toBe(true);
      expect(stopRequested(file, 2000)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("changedScope", () => {
  const all = ["check", "ctx", "schema"];
  it("scopes a package to its changed src files when nothing else in it changed", () => {
    expect(changedScope(["packages/ctx/src/a.ts", "packages/ctx/src/internal/b.ts", "docs/x.md"], all)).toEqual([
      { pkg: "ctx", mutate: ["src/a.ts", "src/internal/b.ts"] },
    ]);
  });
  it("runs a package whole when a test, a config or an unmutated file changed", () => {
    expect(changedScope(["packages/ctx/src/a.ts", "packages/ctx/test/a.test.ts"], all)).toEqual([{ pkg: "ctx" }]);
    expect(changedScope(["packages/schema/src/index.ts"], all)).toEqual([{ pkg: "schema" }]);
    expect(changedScope(["packages/schema/src/types/T.ts"], all)).toEqual([{ pkg: "schema" }]);
  });
  it("keeps a run scoped when only prose changed beside src", () => {
    expect(changedScope(["packages/ctx/src/a.ts", "packages/ctx/README.md"], all)).toEqual([
      { pkg: "ctx", mutate: ["src/a.ts"] },
    ]);
    expect(changedScope(["packages/ctx/README.md"], all)).toEqual([]);
  });
  it("runs every package whole when the shared mutation tooling changed", () => {
    expect(changedScope(["tooling/quick-first.ts"], all)).toEqual([
      { pkg: "check" },
      { pkg: "ctx" },
      { pkg: "schema" },
    ]);
  });
  it("skips reports, run state and packages without a Stryker config", () => {
    expect(
      changedScope(
        ["packages/ctx/reports/mutation/mutation.json", "packages/ctx/.stryker-tmp/run.json", "packages/ui/src/a.ts"],
        all,
      ),
    ).toEqual([]);
  });
  it("keeps the order of `all`", () => {
    expect(changedScope(["packages/schema/src/a.ts", "packages/check/src/b.ts"], all).map((s) => s.pkg)).toEqual([
      "check",
      "schema",
    ]);
  });
});

describe("quick-first order", () => {
  it("puts the shortest file first, unmeasured files before measured ones, ties by name", () => {
    const times = { "test/slow.test.ts": 900, "test/quick.test.ts": 5 };
    const files = ["test/slow.test.ts", "test/b.test.ts", "test/quick.test.ts", "test/a.test.ts"];
    expect(quickFirstOrder(files, (f) => f, times)).toEqual([
      "test/a.test.ts",
      "test/b.test.ts",
      "test/quick.test.ts",
      "test/slow.test.ts",
    ]);
  });
  it("names a sandbox copy's file as the package names it", () => {
    expect(packageRelative("/r/packages/ctx/.stryker-tmp/sandbox-Ab12/test/a.test.ts", "/elsewhere")).toBe(
      "test/a.test.ts",
    );
    expect(packageRelative("/r/packages/ctx/test/a.test.ts", "/r/packages/ctx")).toBe("test/a.test.ts");
    expect(packageRelative("test/a.test.ts", "/r/packages/ctx")).toBe("test/a.test.ts");
  });
  it("reads no times from a missing file or an unnamed one", () => {
    expect(readTimes(undefined)).toEqual({});
    expect(readTimes("/nonexistent/times.json")).toEqual({});
  });
});
