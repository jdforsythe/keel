// Spec: k.gamut, clause "With color tokens `a` `color(display-p3 0 0.52 0.5)` and `b` `#000000`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports no E1804; `contrast('color(display-p3 0 0.52 0.5)', '#000000')` from `@keel/ui/css` rounds to 4.56; the CSS compiled from those tokens declares `--k-color-a:rgb(0 133 127)` in its `:root` block and `--k-color-a:color(display-p3 0 0.52 0.5)` in a `:root` block under `screen and (color-gamut: p3)` that follows it at once, and `--k-color-a` nowhere else; with `a` `color(display-p3 0 0.51 0.5)` it reports one E1804 whose message holds `4.43:1 in light (P3)`, and with `themes: { paper: { when: 'print' } }` none inside `<Box media=\"print\">` (4.55:1 in sRGB)."
// Spec: k.gamut, clause "With color tokens `a` `oklch(70% 0.48 290)` and `b` `#000000`, `contrast('oklch(70% 0.48 290)', '#000000')` rounds to 7.12 and the compiled CSS declares `--k-color-a` as `rgb(160 131 255)` and, in the block under `screen and (color-gamut: p3)`, as `color(display-p3 0.6085 0.5055 1)`; with `themes: { paper: { when: 'print', color: { a: 'color(display-p3 0 0.52 0.5)' } } }` the `keel.print` layer declares `--k-color-a:rgb(0 133 127)` and no block under `(color-gamut: p3)` holds `color(display-p3 0 0.52 0.5)`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The `contrast` and compiled-CSS half of k.gamut #1 and #3; the E1804 half of #1 is packages/check/conformance/color-gamut-e1804.test.ts, the built CSS of #4 packages/cli/conformance/built-css-colors.test.ts.
// Worked numbers are the clauses' own (4.56, 4.66, 4.43, 7.12, 7.19, `rgb(160 131 255)`, `color(display-p3 0.6085 0.5055 1)`). Two pairs beyond them were recomputed from k.gamut's definitions (CSS Color 4's OKLCH chroma search, JND 0.02, epsilon 0.0001, then each form's luminance as k.values Contrast gives it):
//   `oklch(60% 0.3 150)`: sRGB form `rgb(0 158 54)` (3.53:1 on `#FFFFFF`, 5.94:1 on `#000000`), P3 form `color(display-p3 0 0.6376 0.1386)` (3.46:1 on `#FFFFFF`, 6.07:1 on `#000000`), so `contrast` is 3.46 on white (P3 lower) and 5.94 on black (sRGB lower);
//   `color(display-p3 1 0 0)`: sRGB form `rgb(255 11 12)` (5.31:1 on `#000000`, 3.96:1 on `#FFFFFF`), P3 form itself (5.58:1 on `#000000`, 3.76:1 on `#FFFFFF`), so `contrast` is 5.31 on black and 3.76 on white.
// The sRGB and P3 ratios of whatever form the CSS declares are recomputed from the formulas k.values Contrast states (fixtures.ts `colorRatio`), so a property reads the forms back out of the CSS and checks `contrast` is their lower ratio.
import { contrast } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileWith } from "./base-support.ts";
import { SEED, colorRatio, inSrgb } from "./fixtures.ts";
import { P3_MEDIA, declsOf } from "./gamut-support.ts";

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const round2 = (x: number): number => Math.round(x * 100) / 100;
const cssOf = (a: string, b = BLACK, themes?: unknown): string =>
  compileWith({ color: { a, b }, ...(themes === undefined ? {} : { themes }) }, []).css;
const decls = (css: string) => declsOf(css, "--k-color-a");
/** The declaration of `--k-color-a` in the plain `:root` block and the one in the `:root` block of the media block at once after it. */
const pair = (css: string): { srgb: string | undefined; p3: string | undefined; count: number } => {
  const all = decls(css);
  const first = all.find((f) => f.chain.length === 1 && f.chain[0] === ":root");
  const next = first === undefined ? undefined : first.siblings[first.index + 1];
  const p3 = next?.prelude === P3_MEDIA ? next.rules.find((r) => r.prelude === ":root") : undefined;
  return {
    srgb: first?.value,
    p3: p3?.decls.find((d) => d.startsWith("--k-color-a:"))?.slice("--k-color-a:".length),
    count: all.length,
  };
};
const P3 = "color(display-p3 0 0.52 0.5)";
const OKLCH = "oklch(70% 0.48 290)";

describe("k.gamut #1: a color outside sRGB is judged in its sRGB form and its P3 form", () => {
  test("`contrast('color(display-p3 0 0.52 0.5)', '#000000')` from `@keel/ui/css` rounds to 4.56", () => {
    expect(round2(contrast(P3, BLACK))).toBe(4.56);
  });

  test("`color(display-p3 0 0.52 0.5)` on `#000000` ships `rgb(0 133 127)`, 4.66:1, and itself, 4.56:1, and passes 4.5:1", () => {
    expect(round2(colorRatio("rgb(0 133 127)", BLACK))).toBe(4.66);
    expect(round2(colorRatio(P3, BLACK))).toBe(4.56);
    expect(contrast(P3, BLACK)).toBeGreaterThanOrEqual(4.5);
  });

  test("the CSS compiled from color tokens `a` `color(display-p3 0 0.52 0.5)` and `b` `#000000` declares `--k-color-a:rgb(0 133 127)` in its `:root` block", () => {
    expect(pair(cssOf(P3)).srgb).toBe("rgb(0 133 127)");
  });

  test("and `--k-color-a:color(display-p3 0 0.52 0.5)` in a `:root` block under `screen and (color-gamut: p3)` that follows it at once", () => {
    expect(pair(cssOf(P3)).p3).toBe("color(display-p3 0 0.52 0.5)");
  });

  test("and `--k-color-a` nowhere else: two declarations in all", () => {
    expect(pair(cssOf(P3)).count).toBe(2);
  });

  test("with `a` `color(display-p3 0 0.51 0.5)` on `#000000`, `contrast` rounds to 4.43, the P3 form's ratio below the sRGB form's 4.55", () => {
    expect(round2(contrast("color(display-p3 0 0.51 0.5)", BLACK))).toBe(4.43);
    expect(round2(colorRatio("color(display-p3 0 0.51 0.5)", BLACK))).toBe(4.43);
    expect(pair(cssOf("color(display-p3 0 0.51 0.5)")).srgb).toBe("rgb(0 131 127)");
    expect(round2(colorRatio("rgb(0 131 127)", BLACK))).toBe(4.55);
  });

  test("`oklch(60% 0.3 150)` has sRGB form `rgb(0 158 54)` and P3 form `color(display-p3 0 0.6376 0.1386)`; `contrast` is 3.46 on `#FFFFFF` (P3 lower) and 5.94 on `#000000` (sRGB lower)", () => {
    const p = pair(cssOf("oklch(60% 0.3 150)"));
    expect(p.srgb).toBe("rgb(0 158 54)");
    expect(p.p3).toBe("color(display-p3 0 0.6376 0.1386)");
    expect(round2(contrast("oklch(60% 0.3 150)", WHITE))).toBe(3.46);
    expect(round2(contrast("oklch(60% 0.3 150)", BLACK))).toBe(5.94);
  });

  test("`color(display-p3 1 0 0)` has sRGB form `rgb(255 11 12)` and is its own P3 form; `contrast` is 5.31 on `#000000` (sRGB lower) and 3.76 on `#FFFFFF` (P3 lower)", () => {
    const p = pair(cssOf("color(display-p3 1 0 0)"));
    expect(p.srgb).toBe("rgb(255 11 12)");
    expect(p.p3).toBe("color(display-p3 1 0 0)");
    expect(round2(contrast("color(display-p3 1 0 0)", BLACK))).toBe(5.31);
    expect(round2(contrast("color(display-p3 1 0 0)", WHITE))).toBe(3.76);
  });

  test("whatever the display-p3 color, `contrast` is the lower ratio of the form the CSS declares in the sRGB block and the form in the P3 block, on `#FFFFFF` and on `#000000`", () => {
    const u = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(u, u, u, fc.constantFrom(WHITE, BLACK), (r, g, b, back) => {
        const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
        const p = pair(cssOf(color, back));
        if (inSrgb(color)) {
          expect(p.p3).toBeUndefined();
          expect(p.count).toBe(1);
          expect(Math.abs(contrast(color, back) - colorRatio(color, back))).toBeLessThan(0.011);
        } else {
          expect(p.srgb).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
          expect(p.p3).toBe(color);
          expect(p.count).toBe(2);
          const lower = Math.min(colorRatio(p.srgb ?? "", back), colorRatio(p.p3 ?? "", back));
          expect(Math.abs(contrast(color, back) - lower)).toBeLessThan(0.011);
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.gamut #3: an oklch color and the print layer", () => {
  test("`contrast('oklch(70% 0.48 290)', '#000000')` rounds to 7.12", () => {
    expect(round2(contrast(OKLCH, BLACK))).toBe(7.12);
  });

  test("the compiled CSS declares `--k-color-a` as `rgb(160 131 255)` in its `:root` block", () => {
    expect(pair(cssOf(OKLCH)).srgb).toBe("rgb(160 131 255)");
  });

  test("and, in the block under `screen and (color-gamut: p3)`, as `color(display-p3 0.6085 0.5055 1)`", () => {
    expect(pair(cssOf(OKLCH)).p3).toBe("color(display-p3 0.6085 0.5055 1)");
  });

  test("`oklch(70% 0.48 290)` on `#000000` is 7.19:1 in its sRGB form and 7.12:1 in its P3 form", () => {
    expect(round2(colorRatio("rgb(160 131 255)", BLACK))).toBe(7.19);
    expect(round2(colorRatio("color(display-p3 0.6085 0.5055 1)", BLACK))).toBe(7.12);
  });

  const withPaper = () => cssOf(OKLCH, BLACK, { paper: { when: "print", color: { a: P3 } } });

  test("with `themes: { paper: { when: 'print', color: { a: 'color(display-p3 0 0.52 0.5)' } } }` the `keel.print` layer declares `--k-color-a:rgb(0 133 127)`", () => {
    const inPrint = decls(withPaper()).filter((f) => f.chain.includes("@layer keel.print"));
    expect(inPrint.map((f) => f.value)).toEqual(["rgb(0 133 127)"]);
  });

  test("and no block under `(color-gamut: p3)` holds `color(display-p3 0 0.52 0.5)`", () => {
    const css = withPaper();
    const hits = decls(css).filter((f) => f.chain.includes(P3_MEDIA) && f.value === P3);
    expect(hits).toEqual([]);
    expect(css.replace(/\s+/g, "")).not.toContain(
      "color-gamut:p3){:root{--k-color-a:color(display-p3 0 0.52 0.5)".replace(/\s+/g, ""),
    );
  });

  test("the `keel.print` layer holds no block under `(color-gamut: p3)` at all, so printing shows sRGB forms only", () => {
    const inPrint = decls(withPaper()).filter((f) => f.chain.includes("@layer keel.print"));
    expect(inPrint.some((f) => f.chain.includes(P3_MEDIA))).toBe(false);
    expect(decls(withPaper()).filter((f) => f.chain.includes(P3_MEDIA)).length).toBeGreaterThan(0);
  });

  test("whatever the oklch color outside sRGB, its CSS holds one sRGB form `rgb(<0..255> <0..255> <0..255>)` and one P3 form in 4 decimals at most with no trailing zero, `contrast` the lower of their ratios", () => {
    const l = fc.integer({ min: 10, max: 90 });
    const ch = fc.integer({ min: 20, max: 50 }).map((c) => c / 100);
    const h = fc.integer({ min: 0, max: 359 });
    fc.assert(
      fc.property(l, ch, h, fc.constantFrom(WHITE, BLACK), (lp, c, hue, back) => {
        const color = `oklch(${lp}% ${c} ${hue})`;
        fc.pre(!inSrgb(color));
        const p = pair(cssOf(color, back));
        const m = /^rgb\((\d{1,3}) (\d{1,3}) (\d{1,3})\)$/.exec(p.srgb ?? "");
        expect(m).not.toBeNull();
        for (const v of m?.slice(1) ?? []) expect(Number(v)).toBeLessThanOrEqual(255);
        const q = /^color\(display-p3 (\S+) (\S+) (\S+)\)$/.exec(p.p3 ?? "");
        expect(q).not.toBeNull();
        for (const v of q?.slice(1) ?? []) expect(v).toMatch(/^(0|1|0\.\d{0,3}[1-9])$/);
        const lower = Math.min(colorRatio(p.srgb ?? "", back), colorRatio(p.p3 ?? "", back));
        expect(Math.abs(contrast(color, back) - lower)).toBeLessThan(0.011);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a color inside sRGB has one form, as written, and no block under `(color-gamut: p3)`, whatever the hex", () => {
    const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
    fc.assert(
      fc.property(hex, (c) => {
        const p = pair(cssOf(c));
        expect(p.srgb?.toLowerCase()).toBe(c);
        expect(p.p3).toBeUndefined();
        expect(p.count).toBe(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
