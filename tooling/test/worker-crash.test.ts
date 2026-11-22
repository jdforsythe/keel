// A vitest fork worker that dies mid-test, run for real: a child vitest over fixtures that SIGKILL or abort their own
// worker. The reporter prints one T0001 line per dead worker at its file, naming the test and what ended it.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crashDiags, isCrash } from "../vitest-reporter.ts";
import { describeExit, lastSaid, requestFiles } from "../worker-exits.ts";

const root = path.join(import.meta.dirname, "..", "..");
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "crash");
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");

describe("a worker that dies mid-run", () => {
  it("is one T0001 line per file naming the test and the signal, and the run fails", () => {
    const r = spawnSync(process.execPath, [vitest, "run"], {
      cwd: fixtures,
      env: { ...process.env, KEEL_AGENT: "1" },
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(r.status).toBe(1);
    const lines = r.stdout.split("\n").filter((l) => l.startsWith("T0001 "));
    expect(lines).toContain("T0001 kill.fixture.ts:1:1 is killed: worker killed by SIGKILL");
    expect(lines).toContain(
      "T0001 abort.fixture.ts:1:1 aborts: worker killed by SIGABRT: FATAL ERROR: Reached heap limit Allocation failed",
    );
    expect(lines.filter((l) => l.startsWith("T0001 plain.fixture.ts:"))).toHaveLength(1);
    expect(lines.some((l) => l.includes("[vitest-pool]"))).toBe(false);
    expect(r.stdout).toMatch(/^fail 3 tests, 3 failed, 0 skipped/m);
  }, 90_000);
});

describe("crashDiags", () => {
  const exit = (files: string[], said = "") => ({ pid: 1, code: null, signal: "SIGKILL", files, said });
  it("pairs each exit with the unfinished files vitest sent that worker", () => {
    const d = crashDiags(
      2,
      [
        { file: "/r/a.test.ts", test: "a > one" },
        { file: "/r/b.test.ts", test: undefined },
      ],
      [exit(["/r/b.test.ts"]), exit(["/r/a.test.ts"], "out of memory")],
      "/r",
    );
    expect(d.map((x) => `${x.path}:${x.line} ${x.message}`)).toEqual([
      "b.test.ts:1 collecting the file: worker killed by SIGKILL",
      "a.test.ts:1 a > one: worker killed by SIGKILL: out of memory",
    ]);
  });
  it("prints no second line for a worker whose last word is its own diagnostic", () => {
    const said = 'T0001 a.test.ts:1:1 watchdog killed "x" after 9.0s (bound 8.0s)';
    expect(crashDiags(1, [{ file: "/r/a.test.ts", test: "x" }], [exit(["/r/a.test.ts"], said)], "/r")).toEqual([]);
  });
  it("still names a death with no exit recorded and no file left", () => {
    expect(crashDiags(1, [], [], "/r")).toEqual([
      { kind: "diag", code: "T0001", message: "worker exited unexpectedly" },
    ]);
  });
  it("is nothing without a crash", () => {
    expect(crashDiags(0, [{ file: "/r/a.test.ts", test: undefined }], [], "/r")).toEqual([]);
  });
  it("knows vitest's crash error", () => {
    expect(isCrash(new Error("[vitest-pool]: Worker forks emitted error."))).toBe(true);
    expect(isCrash(new Error("expected 1 to be 2"))).toBe(false);
  });
});

describe("worker exits", () => {
  it("say the signal or the exit code, then what the worker said", () => {
    expect(describeExit({ pid: 1, code: null, signal: "SIGSEGV", files: [], said: "" })).toBe(
      "worker killed by SIGSEGV",
    );
    expect(describeExit({ pid: 1, code: 7, signal: null, files: [], said: "boom" })).toBe("worker exited 7: boom");
    expect(describeExit(undefined)).toBe("worker exited unexpectedly");
  });
  it("take the last fatal line over Node's native stack", () => {
    expect(
      lastSaid([
        "",
        "FATAL ERROR: heap limit",
        " 1: 0x1047d87d8 node::Start()",
        "----- JavaScript stack trace -----",
        "",
      ]),
    ).toBe("FATAL ERROR: heap limit");
    expect(lastSaid(["one", "two", ""])).toBe("two");
    expect(lastSaid([])).toBe("");
  });
  it("read the files of a vitest worker request", () => {
    expect(requestFiles({ type: "run", context: { files: [{ filepath: "/r/a.test.ts" }, { x: 1 }] } })).toEqual([
      "/r/a.test.ts",
    ]);
    expect(requestFiles({ type: "stop" })).toBeUndefined();
    expect(requestFiles("x")).toBeUndefined();
  });
});
