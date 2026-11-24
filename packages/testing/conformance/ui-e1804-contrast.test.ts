// Spec: k.ui Conformance, "`fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it". Seed: 1337.
// The real diagnostic through `check()` on a fixture of `<Box fg bg>` and the spec tokens (the `tokens` project artifact).
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";
import { tokens } from "./ui-fixtures.ts";

const fixture = (jsx: string) => [
  { path: "src/C.tsx", source: `import { Box } from '@keel/ui'\nexport default function C() { return ${jsx} }\n` },
];
const e1804 = (jsx: string, t: unknown = tokens) =>
  check(fixture(jsx), { artifacts: { tokens: t }, types: false }).diagnostics.filter((d) => d.code === "E1804");

describe("k.ui: fg='fg' bg='bg' with the spec tokens passes E1804 in both schemes; a pair at 3:1 fails it", () => {
  it('<Box fg="fg" bg="bg"> passes E1804 (light 18.9:1 and dark 15.3:1)', () => {
    expect(e1804('<Box fg="fg" bg="bg">x</Box>')).toEqual([]);
  }, 30_000);

  it("a pair at 3:1 fails E1804, reported at the element with the code, path and scheme", () => {
    const t = defineTokens({ color: { fg: { light: "#949494", dark: "#eee" }, bg: { light: "#fff", dark: "#111" } } });
    const d = e1804('<Box fg="fg" bg="bg">x</Box>', t);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: "E1804", path: "src/C.tsx", line: 2 });
    expect(d[0]?.message).toContain("in light");
    expect(d[0]?.message).toContain("3.03:1");
  }, 30_000);

  it("each scheme is checked: a pair failing only in dark fails", () => {
    const t = defineTokens({ color: { fg: { light: "#111", dark: "#949494" }, bg: { light: "#fff", dark: "#fff" } } });
    const d = e1804('<Box fg="fg" bg="bg">x</Box>', t);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toContain("in dark");
  }, 30_000);

  it("3:1 passes at fontSize >= 24px (lg) and fails below it (sm)", () => {
    const t = defineTokens({
      color: { fg: "#949494", bg: "#ffffff" },
      fontSize: { sm: "14px", lg: "24px" },
    });
    expect(e1804('<Box fg="fg" bg="bg" fontSize="lg">x</Box>', t)).toEqual([]);
    expect(e1804('<Box fg="fg" bg="bg" fontSize="sm">x</Box>', t)).toHaveLength(1);
  }, 30_000);

  it("for any pair of grays, E1804 fires exactly when the WCAG ratio is below 4.5", () => {
    const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
    const lum = (n: number): number => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
        const ratio = (hi + 0.05) / (lo + 0.05);
        fc.pre(Math.abs(ratio - 4.5) > 0.01);
        const t = defineTokens({ color: { fg: hex(a), bg: hex(b) } });
        expect(e1804('<Box fg="fg" bg="bg">x</Box>', t).length).toBe(ratio < 4.5 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  }, 30_000);
});
