import { describe, expect, it } from "vitest";
import { failMessage, turboVerdict } from "../turbo-verdict.mjs";

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
    expect(failMessage("test", v)).toBe("turbo test failed: @keel/cli#test; 3 of 60 tasks unfinished");
  });
  it("names every failed task", () => {
    const v = turboVerdict(1, summary(58, 60, "@keel/cli#test, @keel/std-offline#test"));
    expect(v.failed).toEqual(["@keel/cli#test", "@keel/std-offline#test"]);
    expect(failMessage("test", v)).toBe("turbo test failed: @keel/cli#test, @keel/std-offline#test");
  });
  it("fails a run a signal ended, with no summary", () => {
    const v = turboVerdict(null, "@keel/std-offline:test: $ vitest run\n");
    expect(v.ok).toBe(false);
    expect(failMessage("test", v)).toBe("turbo test failed: no task summary");
  });
  it("fails an exit 0 whose summary has a task short of success", () => {
    expect(turboVerdict(0, summary(12, 13)).ok).toBe(false);
  });
});
