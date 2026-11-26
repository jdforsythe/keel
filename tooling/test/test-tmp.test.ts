// The temp-folder discipline: `tempDir` removes what it makes (test-tmp.ts) and a run's own temp root names what a test
// left in it (test-tmp-global.ts).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import setup from "../test-tmp-global.ts";
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
