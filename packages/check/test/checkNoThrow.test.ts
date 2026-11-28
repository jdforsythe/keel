import { describe, expect, it } from "vitest";
import { check, defineRule } from "../src/index.ts";
import { checkNoThrow } from "./support/checkNoThrow.ts";

defineRule({
  code: "E2998",
  message: "never",
  explain: "a rule that always throws, for the test helper",
  check: () => {
    throw new Error("boom");
  },
});

describe("checkNoThrow", () => {
  it("check turns a throwing rule into E1756, which the helper refuses to return", () => {
    const files = [{ path: "a.ts", source: "export const a = 1\n" }];
    expect(check(files, { types: false }).diagnostics.map((d) => d.code)).toContain("E1756");
    expect(() => checkNoThrow(files, { types: false })).toThrow(/rule E2998 threw: boom/);
  });
});
