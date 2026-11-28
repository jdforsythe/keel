// Spec: k.a11y, clause "With tokens `base.focus: 'fg'`, a `Button` reached by Tab has a 2px solid outline in `fg` at 2px offset in Chromium and one focused by a pointer click has none; a `base.focus` color at 2:1 against `base.page`'s `bg` is E1807, and `brandTokens` passes."
// k.a11y, Rules "E1807" via k.ui: "a `base.focus` color under 3:1 against `base.page`'s `bg` in either scheme is E1807."
// Seed: 1337 (property over grey pairs).
// Not built yet: every case is `test.skip`; the builder changes `test.skip` to `test` in each.
// Assumed: the E1807 for a low `base.focus` is thrown by `defineTokens` and by `compileStyles`, as the other E1807 causes are (rules-e1801-e1807-codes-0065.test.ts), and `TokenSchema.parse` returns `ok: false`.
// The Tab and click behavior is Chromium's and is not testable here (no browser in this suite); the CSS it follows from is asserted: a 2px solid outline in the focus color at 2px offset on `:focus-visible`, and no `:focus` outline.
import { TokenSchema } from "@keel/ui/tokens";
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, ratio } from "./fixtures.ts";
import { baseLayer, codeOf, compileWith, withGroups } from "./base-support.ts";

const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
const colors = (focus: string, bg: string) => ({
  color: { fg: focus, bg, accent: "#0a5" },
  base: { page: { bg: "bg" }, focus: "fg" },
});
const build = (focus: string, bg: string) => () => withGroups(colors(focus, bg));

describe("k.a11y: the base.focus ring", () => {
  test("with `base.focus: 'fg'` the layer gives `:focus-visible` a 2px solid outline in `fg` at 2px offset", () => {
    const { css } = compileWith({ base: { focus: "fg" } }, []);
    const layer = baseLayer(css) ?? "";
    expect(layer).toMatch(/:focus-visible\{[^}]*outline:2px solid var\(--k-color-fg\)/);
    expect(layer).toMatch(/:focus-visible\{[^}]*outline-offset:2px/);
  });

  test("a pointer click shows no ring: the layer has no `:focus` outline, only `:focus-visible`", () => {
    const { css } = compileWith({ base: { focus: "fg" } }, []);
    const layer = baseLayer(css) ?? "";
    expect(layer).not.toMatch(/:focus(?!-visible)[^{]*\{[^}]*outline/);
  });

  test("without `base.focus` the layer has no outline rule, and the platform's indicator stays", () => {
    const { css } = compileWith({ base: { page: { fg: "fg" } } }, []);
    expect(baseLayer(css) ?? "").not.toContain("outline");
  });

  test("a `base.focus` color at 2:1 against `base.page`'s `bg` is E1807", () => {
    // #949494 on #ffffff is 3.03:1; #b0b0b0 on #ffffff is 2.17:1; #bbbbbb is 1.92:1.
    expect(ratio("#bbbbbb", "#ffffff")).toBeLessThan(3);
    expect(codeOf(build("#bbbbbb", "#ffffff"))).toBe("E1807");
    expect(TokenSchema.parse(JSON.parse(JSON.stringify(colors("#bbbbbb", "#ffffff")))).ok).toBe(false);
  });

  test("a `base.focus` color at 3:1 or more passes", () => {
    expect(ratio("#767676", "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(codeOf(build("#767676", "#ffffff"))).toBe(null);
  });

  test("E1807 exactly when the ratio against `base.page`'s `bg` is under 3 (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        const focus = hex(a);
        const bg = hex(b);
        expect(codeOf(build(focus, bg))).toBe(ratio(focus, bg) < 3 ? "E1807" : null);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("it is judged in either scheme: a `{ light, dark }` focus that fails in dark only is E1807", () => {
    const pair = (): unknown =>
      withGroups({
        color: { fg: { light: "#000000", dark: "#222222" }, bg: { light: "#ffffff", dark: "#111111" } },
        base: { page: { bg: "bg" }, focus: "fg" },
      });
    expect(codeOf(pair)).toBe("E1807");
  });
});
