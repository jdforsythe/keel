import { describe, expect, it } from "vitest";
import { stepNotes } from "../src/internal/stepNotes.ts";

describe("stepNotes", () => {
  it("keeps an advisory step's error-coded line as stderr text so it leaves the exit code alone", () => {
    const r = stepNotes(["E1006 modules/a/routes.ts failed to evaluate: boom\n"], true);
    expect(r.diagnostics).toEqual([]);
    expect(r.stderr).toBe("E1006 modules/a/routes.ts failed to evaluate: boom\n");
  });

  it("keeps an advisory step's warning as stderr text", () => {
    const r = stepNotes(["W1005 .keel/routes.json differed from routes.ts; rewritten\n"], true);
    expect(r.diagnostics).toEqual([]);
    expect(r.stderr).toBe("W1005 .keel/routes.json differed from routes.ts; rewritten\n");
  });

  it("makes a failing step's error-coded line a diagnostic", () => {
    const r = stepNotes(["E1006 modules/a/api.ts failed to evaluate: boom\n"], false);
    expect(r.diagnostics.map((d) => d.code)).toEqual(["E1006"]);
    expect(r.stderr).toBe("");
  });

  it("passes a line without a code to stderr", () => {
    expect(stepNotes(["plain\n"], false).stderr).toBe("plain\n");
  });
});
