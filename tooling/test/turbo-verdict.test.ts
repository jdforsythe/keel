import { describe, expect, it } from "vitest";
import { failVerdict, taskFailures, turboVerdict } from "../turbo-verdict.mjs";

const summary = (successful: number, total: number, failed?: string): string =>
  [
    "@keel/cli:test: fail 1350 tests, 1 failed, 0 skipped (205.2s)",
    ` Tasks:    ${successful} successful, ${total} total`,
    `Cached:    0 cached, ${total} total`,
    "  Time:    7m3.2s ",
    ...(failed === undefined ? [] : [`Failed:    ${failed}`]),
  ].join("\n");

describe("turboVerdict", () => {
  it("is ok when turbo exited 0 and every task succeeded", () => {
    expect(turboVerdict(0, summary(13, 13))).toEqual({
      ok: true,
      successful: 13,
      total: 13,
      failed: [],
      unfinished: 0,
    });
  });
  it("counts the tasks turbo cancelled after one failed as unfinished", () => {
    const v = turboVerdict(1, summary(56, 60, "@keel/cli#test"));
    expect(v).toEqual({ ok: false, successful: 56, total: 60, failed: ["@keel/cli#test"], unfinished: 3 });
    expect(failVerdict("test", v, taskFailures(v.failed, "", {}))).toBe(
      "turbo test failed: @keel/cli#test exit ?, no test named; 3 of 60 tasks unfinished",
    );
  });
  it("names every failed task", () => {
    const v = turboVerdict(1, summary(58, 60, "@keel/cli#test, @keel/std-offline#test"));
    expect(v.failed).toEqual(["@keel/cli#test", "@keel/std-offline#test"]);
    expect(failVerdict("test", v, taskFailures(v.failed, "", {}))).toBe(
      "turbo test failed: @keel/cli#test exit ?, no test named; @keel/std-offline#test exit ?, no test named",
    );
  });
  it("fails a run a signal ended, with no summary", () => {
    const v = turboVerdict(null, "@keel/std-offline:test: $ vitest run\n");
    expect(v.ok).toBe(false);
    expect(failVerdict("test", v, [])).toBe("turbo test failed: no task summary");
  });
  it("fails an exit 0 whose summary has a task short of success", () => {
    expect(turboVerdict(0, summary(12, 13)).ok).toBe(false);
  });
});

describe("taskFailures", () => {
  const log = [
    "@keel/cli:test: $ vitest run",
    "@keel/cli:test: some child process noise",
    "@keel/cli:test: T0001 conformance/a.test.ts:12:5 review > escapes: Test timed out in 120000ms.",
    "@keel/cli:test: T0001 test/b.test.ts:3:1 b > equal: expected { a: 1 } to deeply equal { a: 2 }",
    '@keel/cli:test:   fix: -   "a": 2,',
    '@keel/cli:test:        +   "a": 1,',
    "@keel/cli:test: T0001 test/b.test.ts:9:1 b > other: nope",
    "@keel/cli:test: fail 1350 tests, 3 failed, 0 skipped (205.2s)",
    "@keel/std-ui:test: T0001 test/c.test.ts:1:1 passes elsewhere",
    "@keel/std-postgres:test: $ vitest run",
    "@keel/std-postgres:test: Error: listen EADDRINUSE 127.0.0.1:5432",
    "@keel/std-postgres:test: [ELIFECYCLE] Test failed.",
    "@keel/std-postgres#test:  ERROR  command (/r/packages/std-postgres) pnpm run test exited (137)",
  ].join("\n");
  const dirs = { "@keel/cli": "packages/cli", "@keel/std-postgres": "packages/std-postgres" };
  const v = turboVerdict(1, `${log}\n${summary(58, 60, "@keel/cli#test, @keel/std-postgres#test")}`);
  const f = taskFailures(v.failed, log, dirs);

  it("lists each failed test of a task at its path from the repository, with its fix lines", () => {
    expect(f[0]?.diags).toEqual([
      "T0001 packages/cli/conformance/a.test.ts:12:5 review > escapes: Test timed out in 120000ms.",
      "T0001 packages/cli/test/b.test.ts:3:1 b > equal: expected { a: 1 } to deeply equal { a: 2 }",
      "T0001 packages/cli/test/b.test.ts:9:1 b > other: nope",
    ]);
    expect(f[0]?.lines).toHaveLength(5);
    expect(f[0]?.trailer).toBe("fail 1350 tests, 3 failed, 0 skipped (205.2s)");
  });
  it("keeps the exit status and the last lines of a task that named no test", () => {
    expect(f[1]?.diags).toEqual([]);
    expect(f[1]?.exit).toBe(137);
    expect(f[1]?.tail).toEqual(["Error: listen EADDRINUSE 127.0.0.1:5432"]);
  });
  it("names every failed test's file and line per task in the verdict", () => {
    expect(failVerdict("test", v, f)).toBe(
      "turbo test failed: @keel/cli#test packages/cli/conformance/a.test.ts:12, packages/cli/test/b.test.ts:3, " +
        "packages/cli/test/b.test.ts:9; @keel/std-postgres#test exit 137: Error: listen EADDRINUSE 127.0.0.1:5432",
    );
  });
});
