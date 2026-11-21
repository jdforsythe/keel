// Spec: k.ui Rules E1801 (raw value where a token is required) and E1807 (`tokens.ts` fails `TokenSchema`): the thrown
// error carries the code (rfc:0065, backlog 0186). No random inputs.
import { defineTokens } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import { describe, expect, it } from "vitest";
import { tokens } from "./fixtures.ts";

/** The `code` of what `f` throws, or null when it does not throw a coded error. */
const codeOf = (f: () => unknown): unknown => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : null;
  }
};

describe("k.ui: coded errors", () => {
  it("compileStyles throws E1801 for a raw value where a token is required", () => {
    expect(codeOf(() => compileStyles({ tokens, usages: [{ props: { p: "16px" } }] }))).toBe("E1801");
    expect(codeOf(() => compileStyles({ tokens, usages: [{ props: {} }] }))).toBe(null);
  });
  it("defineTokens and compileStyles throw E1807 for tokens outside TokenSchema", () => {
    expect(codeOf(() => defineTokens(JSON.parse('{"space":{"1":4}}')))).toBe("E1807");
    expect(codeOf(() => compileStyles({ tokens: { space: { 1: "1px;}" } }, usages: [] }))).toBe("E1807");
    expect(codeOf(() => defineTokens(tokens))).toBe(null);
  });
});
