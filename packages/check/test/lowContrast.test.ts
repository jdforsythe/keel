import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const tokens = {
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" }, mid: "#949494", white: "#fff" },
  fontSize: { sm: "14px", lg: "24px" },
};
const run = (jsx: string, t: unknown = tokens, withTokens = true) =>
  check(
    [{ path: "src/C.tsx", source: `import { Box } from '@keel/ui'\nexport default function C() { return ${jsx} }\n` }],
    {
      artifacts: withTokens ? { tokens: t } : {},
      types: false,
    },
  ).diagnostics.filter((d) => d.code === "E1804");

describe("E1804", () => {
  it("passes fg/bg tokens at 4.5:1 or better in both schemes", () => {
    expect(run('<Box fg="fg" bg="bg">x</Box>')).toEqual([]);
  });
  it("reports a 3:1 pair and names the scheme", () => {
    const d = run('<Box fg="mid" bg="white">x</Box>');
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toContain("in light");
  });
  it("allows 3:1 at fontSize >= 24px", () => {
    expect(run('<Box fg="mid" bg="white" fontSize="lg">x</Box>')).toEqual([]);
    expect(run('<Box fg="mid" bg="white" fontSize="sm">x</Box>')).toHaveLength(1);
  });
  it("reports nothing without a tokens artifact or for unknown tokens", () => {
    expect(run('<Box fg="mid" bg="white">x</Box>', tokens, false)).toEqual([]);
    expect(run('<Box fg="nope" bg="white">x</Box>')).toEqual([]);
  });
});
