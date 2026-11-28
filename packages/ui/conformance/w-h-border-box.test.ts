// Spec: k.ui, clause "An `Input` with `w=\"full\" px=\"2\" border=\"control\"` in a 320px container is 320px wide in Chromium; the `w` rule declares `box-sizing:border-box`."
// k.ui, Conformance "`w` and `h` size the border box." (Style props paragraph)
// Seed: 1337 (property over size and space tokens).
// Live on the main line. The 320px width in Chromium is not testable here (no browser in this suite); the `box-sizing:border-box` declaration is what it follows from.
import { defineTokens } from "@keel/ui/tokens";
import { compileStyles } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, norm, tokens } from "./fixtures.ts";

const sized = defineTokens({ ...tokens, size: { full: "100%", measure: "44rem" } });
const declarations = (css: string, cls: string): string => {
  const m = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(norm(css));
  return m?.[1] ?? "";
};

describe("k.ui: w and h size the border box", () => {
  it('the `w` rule of `w="full"` declares `box-sizing:border-box`', () => {
    const { classes, css } = compileStyles({ tokens: sized, usages: [{ props: { w: "full", px: "2" } }] });
    const w = (classes[0] ?? []).find((c) => c.startsWith("k-w-"));
    expect(w).toBe("k-w-full");
    expect(declarations(css, "k-w-full")).toContain("box-sizing:border-box");
  });

  it("the `h` rule declares `box-sizing:border-box`", () => {
    const { classes, css } = compileStyles({ tokens: sized, usages: [{ props: { h: "full" } }] });
    const h = (classes[0] ?? []).find((c) => c.startsWith("k-h-"));
    expect(h).toBe("k-h-full");
    expect(declarations(css, "k-h-full")).toContain("box-sizing:border-box");
  });

  it("every `w` and `h` token rule declares `box-sizing:border-box` (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("w", "h"), fc.constantFrom("full", "measure", "0", "1", "2", "3"), (prop, token) => {
        const { css } = compileStyles({ tokens: sized, usages: [{ props: { [prop]: token } }] });
        expect(declarations(css, `k-${prop}-${token}`)).toContain("box-sizing:border-box");
      }),
      { seed: SEED, numRuns: 24 },
    );
  });
});
