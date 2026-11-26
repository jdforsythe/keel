// The temp-folder discipline: `tempDir` removes what it makes (test-tmp.ts) and a run's own temp root names what a test
// left in it (test-tmp-global.ts).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import setup, { STALE_MS, SWEEP_LIMIT, sweepStaleRoots } from "../test-tmp-global.ts";
import { removeTempDirs, tempDir } from "../test-tmp.ts";

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("tempDir", () => {
  it("makes a folder named by its prefix in the run's temp folder and removeTempDirs removes it", () => {
    const dir = tempDir("keel-helper-");
    expect(path.dirname(dir)).toBe(os.tmpdir());
    expect(path.basename(dir)).toMatch(/^keel-helper-.{6}$/);
    fs.writeFileSync(path.join(dir, "f"), "x");
    removeTempDirs();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("makes the folder in a parent that is given", () => {
    const parent = tempDir("keel-parent-");
    const dir = tempDir("keel-child-", parent);
    expect(path.dirname(dir)).toBe(parent);
    removeTempDirs();
    expect(fs.existsSync(parent)).toBe(false);
  });
});

describe("the run's temp root", () => {
  /** Runs `setup`, then `work` with `TMPDIR` pointing at the run's root, then the teardown; returns what it wrote to stderr. */
  function run(work: (root: string) => void): { stderr: string; root: string; restored: boolean } {
    const before = process.env.TMPDIR;
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const teardown = setup();
    const root = os.tmpdir();
    work(root);
    teardown();
    const stderr = write.mock.calls.map((c) => String(c[0])).join("");
    return { stderr, root, restored: process.env.TMPDIR === before };
  }

  it("is removed at the end, with TMPDIR restored and the run still passing when nothing was left", () => {
    const r = run(() => undefined);
    expect(r.stderr).toBe("");
    expect(process.exitCode).toBeUndefined();
    expect(r.restored).toBe(true);
    expect(fs.existsSync(r.root)).toBe(false);
  });

  it("fails the run with one T0002 line per prefix left, and still removes the root", () => {
    const r = run((root) => {
      tempDir("keel-leaky-", root);
      tempDir("keel-leaky-", root);
      tempDir("keel-other-", root);
    });
    const lines = r.stderr.split("\n").filter((l) => l !== "");
    expect(lines.map((l) => l.split(" ").slice(0, 3).join(" "))).toEqual([
      "T0002 keel-leaky-* 2",
      "T0002 keel-other-* 1",
    ]);
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(r.root)).toBe(false);
  });
});

describe("the sweep of stale run roots", () => {
  const age = (dir: string, ms: number): void => {
    const then = new Date(Date.now() - ms);
    fs.utimesSync(dir, then, then);
  };

  it("removes run roots untouched for a day and keeps a newer one, other folders and files", () => {
    const outer = tempDir("keel-sweep-outer-");
    const stale = fs.mkdtempSync(path.join(outer, "keel-run-"));
    const live = fs.mkdtempSync(path.join(outer, "keel-run-"));
    const other = fs.mkdtempSync(path.join(outer, "keel-other-"));
    const file = path.join(outer, "keel-run-abcdef");
    fs.writeFileSync(file, "x");
    fs.writeFileSync(path.join(stale, "f"), "x");
    for (const dir of [stale, other, file]) age(dir, STALE_MS + 60_000);
    age(live, STALE_MS - 60_000);
    expect(sweepStaleRoots(outer)).toBe(1);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(live)).toBe(true);
    expect(fs.existsSync(other)).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("does not follow a link named like a run root", () => {
    const outer = tempDir("keel-sweep-outer-");
    const target = tempDir("keel-sweep-target-");
    const link = path.join(outer, "keel-run-link12");
    fs.symlinkSync(target, link);
    expect(sweepStaleRoots(outer, Date.now() + 2 * STALE_MS)).toBe(0);
    expect(fs.existsSync(target)).toBe(true);
  });

  it("removes at most SWEEP_LIMIT roots in one run and a missing folder is not an error", () => {
    const outer = tempDir("keel-sweep-outer-");
    for (let i = 0; i < SWEEP_LIMIT + 3; i++) age(fs.mkdtempSync(path.join(outer, "keel-run-")), STALE_MS + 60_000);
    expect(sweepStaleRoots(outer)).toBe(SWEEP_LIMIT);
    expect(fs.readdirSync(outer)).toHaveLength(3);
    expect(sweepStaleRoots(path.join(outer, "missing"))).toBe(0);
  });

  it("runs at the start of a run, so a killed run's root is gone after the next run begins", () => {
    const outer = tempDir("keel-sweep-outer-");
    const stale = fs.mkdtempSync(path.join(outer, "keel-run-"));
    age(stale, STALE_MS + 60_000);
    const before = process.env.TMPDIR;
    process.env.TMPDIR = outer;
    const teardown = setup();
    teardown();
    if (before === undefined) Reflect.deleteProperty(process.env, "TMPDIR");
    else process.env.TMPDIR = before;
    expect(fs.existsSync(stale)).toBe(false);
  });
});
