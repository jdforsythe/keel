// Spec: k.gamut, clause "With color tokens `a` `color(display-p3 0 0.52 0.5)` and `b` `#000000`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports no E1804; `contrast('color(display-p3 0 0.52 0.5)', '#000000')` from `@keel/ui/css` rounds to 4.56; the CSS compiled from those tokens declares `--k-color-a:rgb(0 133 127)` in its `:root` block and `--k-color-a:color(display-p3 0 0.52 0.5)` in a `:root` block under `screen and (color-gamut: p3)` that follows it at once, and `--k-color-a` nowhere else; with `a` `color(display-p3 0 0.51 0.5)` it reports one E1804 whose message holds `4.43:1 in light (P3)`, and with `themes: { paper: { when: 'print' } }` none inside `<Box media=\"print\">` (4.55:1 in sRGB)."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The E1804 half of k.gamut #1; its `contrast` and compiled-CSS half is packages/ui/conformance/color-gamut-forms.test.ts.
// ASSUMPTIONS: as color-forms-e1804.test.ts (tokens reach `check()` as `artifacts: { tokens }`; a `<Text fg bg>` in a component's outermost element is judged); a message is `fg "<fg>" on bg "<bg>" is <ratio>:1 in <combination> (<form>), needs <need>:1` (k.a11y-static Message). `<Box media="print">` is judged in the printing combinations only (k.a11y-static Combinations).
// Worked numbers: the clause's own `4.43:1 in light (P3)` and `4.55:1 in sRGB`. Two pairs beyond them were recomputed from k.gamut's definitions (CSS Color 4's OKLCH chroma search, then each form's luminance), see packages/ui/conformance/color-gamut-forms.test.ts: `oklch(60% 0.3 150)` on `#FFFFFF` is 3.53:1 in its sRGB form `rgb(0 158 54)` and 3.46:1 in its P3 form, so one E1804 at `3.46:1 in light (P3)`; `color(display-p3 1 0 0)` on `#FFFFFF` is 3.96:1 sRGB and 3.76:1 P3.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, insideSrgb, looseTokens, one, ratioOf } from "./support.ts";

const IMPORTS = `import { Box, Text } from '@keel/ui'\n`;
const view = (jsx: string) => one(`${IMPORTS}export default function C() { return ${jsx} }\n`);
const TEXT = `<Text fg="a" bg="b">x</Text>`;
const e1804 = (a: string, b: string, jsx = TEXT, themes?: unknown, extra: Record<string, unknown> = {}) =>
  check(view(jsx), {
    artifacts: { tokens: looseTokens({ color: { a, b }, ...(themes === undefined ? {} : { themes }), ...extra }) },
    types: false,
  }).diagnostics.filter((d) => d.code === "E1804");
const P3 = "color(display-p3 0 0.52 0.5)";
const P3_LOW = "color(display-p3 0 0.51 0.5)";

describe("k.gamut #1: E1804 judges each shipped form and the lower ratio stands", () => {
  test(
    'With color tokens `a` `color(display-p3 0 0.52 0.5)` and `b` `#000000`, `<Text fg="a" bg="b">x</Text>` reports no E1804',
    () => {
      expect(e1804(P3, "#000000")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with `a` `color(display-p3 0 0.51 0.5)` it reports one E1804 whose message holds `4.43:1 in light (P3)`",
    () => {
      const d = e1804(P3_LOW, "#000000");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toContain("4.43:1 in light (P3)");
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 4.43:1 in light (P3), needs 4.5:1');
      expect(ratioOf(P3_LOW, "#000000")).toBe("4.43");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "and with `themes: { paper: { when: 'print' } }` none inside `<Box media=\"print\">` (4.55:1 in sRGB)",
    () => {
      const paper = { paper: { when: "print" } };
      expect(e1804(P3_LOW, "#000000", `<Box media="print">${TEXT}</Box>`, paper)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'with `themes: { paper: { when: \'print\' } }`, the same pair outside `<Box media="print">` is still one E1804 in `light (P3)`, and inside `<Box media="screen">` too: only printing is judged in sRGB forms alone',
    () => {
      const paper = { paper: { when: "print" } };
      for (const jsx of [TEXT, `<Box media="screen">${TEXT}</Box>`]) {
        const d = e1804(P3_LOW, "#000000", jsx, paper);
        expect(d).toHaveLength(1);
        expect(d[0]?.message).toContain("4.43:1 in light (P3)");
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a message names the lower form: `color(display-p3 0 0 1)` on `#000000` is `2.44:1 in light (sRGB)`, its sRGB form `rgb(0 0 255)`, below its P3 form's 2.59:1",
    () => {
      const d = e1804("color(display-p3 0 0 1)", "#000000");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 2.44:1 in light (sRGB), needs 4.5:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`oklch(60% 0.3 150)` on `#FFFFFF`, 3.53:1 in its sRGB form `rgb(0 158 54)` and 3.46:1 in its P3 form, is one E1804 at `3.46:1 in light (P3)`",
    () => {
      const d = e1804("oklch(60% 0.3 150)", "#FFFFFF");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 3.46:1 in light (P3), needs 4.5:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`color(display-p3 1 0 0)` on `#FFFFFF`, 3.96:1 sRGB and 3.76:1 P3, is one E1804 at `3.76:1 in light (P3)`, and on `#000000`, 5.31:1 sRGB, none",
    () => {
      const d = e1804("color(display-p3 1 0 0)", "#FFFFFF");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 3.76:1 in light (P3), needs 4.5:1');
      expect(e1804("color(display-p3 1 0 0)", "#000000")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a pair of colors inside sRGB names no form: `#777777` on `#FFFFFF` ends `in light, needs 4.5:1`",
    () => {
      const d = e1804("#777777", "#FFFFFF");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 4.48:1 in light, needs 4.5:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the display-p3 color outside sRGB on `#FFFFFF`, a message names `(P3)` only when its ratio is the P3 form's, and `(sRGB)` only when that is no higher than the P3 form's",
    () => {
      const u = fc.integer({ min: 0, max: 100 });
      fc.assert(
        fc.property(u, u, u, (r, g, b) => {
          const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
          fc.pre(!insideSrgb(color));
          const p3 = Number(ratioOf(color, "#FFFFFF"));
          const d = e1804(color, "#FFFFFF");
          if (p3 >= 4.5 + 0.02 && d.length === 0) return; // both forms pass
          fc.pre(d.length === 1);
          const m = /is (\d+\.\d\d):1 in light \((sRGB|P3)\), needs 4\.5:1$/.exec(d[0]?.message ?? "");
          expect(m).not.toBeNull();
          const shown = Number(m?.[1]);
          expect(shown).toBeLessThanOrEqual(p3 + 0.011);
          if (m?.[2] === "P3") expect(Math.abs(shown - p3)).toBeLessThanOrEqual(0.011);
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
