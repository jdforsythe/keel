// `keel test` on real (temporary) projects: filters, KEEL_TEST and exitCode restoration, error vs failure.
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const CONFIG = 'export default { test: { globals: true, include: ["*.test.mjs"] } };\n';
const project = (tests: Record<string, string>): { cwd: string; files: { path: string; source: string }[] } => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "keel-mut-test-")));
  mkdirSync(cwd, { recursive: true });
  const all = { "vitest.config.mjs": CONFIG, ...tests };
  for (const [name, source] of Object.entries(all)) writeFileSync(join(cwd, name), source);
  return { cwd, files: Object.entries(all).map(([path, source]) => ({ path, source })) };
};
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");

describe("keel test", () => {
  it("runs with KEEL_TEST=1, restores the caller's KEEL_TEST and exit code, counts tests and skips", async () => {
    const p = project({
      "a.test.mjs":
        'it("sees env", () => { if (process.env.KEEL_TEST !== "1") throw new Error("no env"); });\nit.skip("later", () => {});\nit("two", () => {});\n',
    });
    const before = process.exitCode;
    process.env.KEEL_TEST = "outer";
    try {
      const r = await run(["test"], p);
      expect(lines(r.stdout)).toEqual(["ok test 3 tests, 0 failed, 1 skipped"]);
      expect(r.code).toBe(0);
      expect(process.env.KEEL_TEST).toBe("outer");
    } finally {
      Reflect.deleteProperty(process.env, "KEEL_TEST");
    }
    expect(process.exitCode).toBe(before);
    await run(["test"], p);
    expect("KEEL_TEST" in process.env).toBe(false);
  }, 60_000);

  it("path filters select test files; a failing test is a T0001 diagnostic and the run is not ok", async () => {
    const p = project({
      "a.test.mjs": 'it("fine", () => {});\n',
      "b.test.mjs": 'it("broken", () => { throw new Error("boom"); });\n',
    });
    const onlyA = await run(["test", "a.test.mjs"], p);
    expect(lines(onlyA.stdout)).toEqual(["ok test 1 tests, 0 failed, 0 skipped"]);
    const onlyB = await run(["test", "b.test.mjs"], p);
    expect(onlyB.code).toBe(1);
    expect(lines(onlyB.stdout).at(-1)).toBe("fail test 1 tests, 1 failed, 0 skipped");
    expect(lines(onlyB.stdout)[0]).toMatch(/^T0001 b\.test\.mjs:\d+:\d+ broken: boom/);
    const none = await run(["test", "zzz-no-such.test.mjs"], p);
    expect(lines(none.stdout).at(-1)).toMatch(/^(ok|fail) test 0 tests, 0 failed, 0 skipped$/);
  }, 60_000);

  it("a file that cannot load is one test, failed: the run is not ok", async () => {
    const p = project({ "c.test.mjs": 'throw new Error("cannot load");\n' });
    const r = await run(["test"], p);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("T0001 c.test.mjs:1:1 cannot load\nfail test 1 tests, 1 failed, 0 skipped\n");
  }, 60_000);

  it("an unhandled error with every test passing still makes the run not ok, located at its throw", async () => {
    const p = project({
      "d.test.mjs":
        'it("passes", async () => { setTimeout(() => { throw new Error("late"); }, 0); await new Promise((r) => setTimeout(r, 50)); });\n',
    });
    const r = await run(["test"], p);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("T0001 d.test.mjs:1:53 uncaught: late\nfail test 1 tests, 0 failed, 0 skipped\n");
  }, 60_000);

  it("a project whose files hold a vitest config but no tests still starts vitest", async () => {
    const p = project({});
    const r = await run(["test"], p);
    expect(lines(r.stdout).at(-1)).toMatch(/^(ok|fail) test 0 tests, 0 failed, 0 skipped$/);
  }, 60_000);
});
