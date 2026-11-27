// Spec: k.values, clause "`TokenSchema` accepts as a color each of `rgb(184 66 13)`, `hsl(19deg 87% 39%)`, `oklab(0.54 0.12 0.1)`, `oklch(54% 0.16 40)` and `color(display-p3 0.67 0.29 0.1)`, and refuses with rule `format` each of `rgb(184, 66, 13)`, `rgb(300 0 0)`, `oklch(54% 0.16 40 / 0.5)`, `white`, `oklch(none 0 0)` and `rgb(from #000 r g b)`."
// Spec: k.values, clause "`shadow: { a: '0 1px 2px rgb(0 0 0 / 0.2)' }` and `overlay: { scrim: { value: '#1a191e99', over: ['card'] } }` with a color token `card` are accepted; `overlay: { scrim: { value: '#1a191e', over: ['card'] } }`, one with `over: []`, and one with `over: ['nope']` are each refused with rule `format`, the last at `overlay.scrim.over`."
// Spec: k.values, clause "With color tokens `a` `oklch(0.72 0.14 45)` and `b` `#141317`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports no E1804, and with `a` `color(display-p3 0 0 1)` and `b` `#000000` it reports one whose message holds `2.44:1`, the ratio after mapping to sRGB, which is below the 2.59:1 of the color as given."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// Expected luminances and ratios are recomputed in the test from the formulas k.values Contrast states (fixtures.ts `colorLinear`, `colorLuminance`, `colorRatio`: WCAG linearisation, CSS Color 4 `hslToRgb`, the Oklab matrices, the display-p3 transfer function and matrix), never written as numbers; the one stated number is the clause's own, 2.44 and 2.59.
// The matrices here are the Oklab reference ones and the display-p3 to sRGB one, which agree with CSS Color 4's path through XYZ to about 1e-5, so ratios are compared to 2 decimals (`toBeCloseTo(_, 2)`), the precision E1804 prints.
// ASSUMPTIONS: `contrast(a, b)` from `@keel/ui/css` takes any `<color>` (the build plan: "`contrast` takes any `<color>`") and returns the ratio at which the pair is judged, the lower of as-given and gamut-mapped. The mapped value itself (CSS Color 4's OKLCH chroma search, JND 0.02, epsilon 0.0001) is not recomputed here: its one stated result, 2.44:1 for `color(display-p3 0 0 1)` on black, is asserted, and that no pair is judged above its as-given ratio is a property.
// E1804's half of #8 (`<Text fg bg>` with those tokens) is packages/check/conformance/color-forms-e1804.test.ts.
import { contrast } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, withGroups } from "./base-support.ts";
import { SEED, colorLinear, colorLuminance, colorRatio, inSrgb } from "./fixtures.ts";
import { TokenSchema } from "@keel/ui";

const issuesOf = (tokens: unknown): { path: (string | number)[]; rule: string }[] | null => {
  const r = TokenSchema.parse(tokens);
  return r.ok ? null : r.error.data.issues;
};
const refusedAt = (tokens: unknown, path: (string | number)[]): boolean =>
  (issuesOf(tokens) ?? []).some((i) => i.rule === "format" && i.path.join(".") === path.join("."));
/** A `format` refusal at `overlay.<name>` or below it: the spec gives `value` after the name for a bad `value` and names no path for `over`. */
const refusedUnder = (tokens: unknown, prefix: string): boolean =>
  (issuesOf(tokens) ?? []).some((i) => i.rule === "format" && i.path.join(".").startsWith(prefix));
const FORMS = [
  "rgb(184 66 13)",
  "hsl(19deg 87% 39%)",
  "oklab(0.54 0.12 0.1)",
  "oklch(54% 0.16 40)",
  "color(display-p3 0.67 0.29 0.1)",
] as const;
const BLACK = "#000000";
const WHITE = "#ffffff";
const n = (min: number, max: number, digits: number) =>
  fc
    .integer({ min: 0, max: 10 ** digits })
    .map((i) => Number((min + ((max - min) * i) / 10 ** digits).toFixed(digits)));

describe("k.values: the six opaque forms", () => {
  test("`TokenSchema` accepts as a color each of `rgb(184 66 13)`, `hsl(19deg 87% 39%)`, `oklab(0.54 0.12 0.1)`, `oklch(54% 0.16 40)` and `color(display-p3 0.67 0.29 0.1)`", () => {
    for (const form of FORMS) {
      expect(issuesOf({ color: { a: form } }), form).toBeNull();
      expect(
        codeOf(() => withGroups({ color: { a: form } })),
        form,
      ).toBeNull();
      expect(issuesOf({ color: { a: { light: form, dark: "#ffffff" } } }), `pair ${form}`).toBeNull();
    }
  });

  test("it refuses with rule `format` each of `rgb(184, 66, 13)`, `rgb(300 0 0)`, `oklch(54% 0.16 40 / 0.5)`, `white`, `oklch(none 0 0)` and `rgb(from #000 r g b)`", () => {
    for (const bad of [
      "rgb(184, 66, 13)",
      "rgb(300 0 0)",
      "oklch(54% 0.16 40 / 0.5)",
      "white",
      "oklch(none 0 0)",
      "rgb(from #000 r g b)",
    ]) {
      expect(refusedAt({ color: { a: bad } }, ["color", "a"]), bad).toBe(true);
      expect(
        codeOf(() => withGroups({ color: { a: bad } })),
        bad,
      ).toBe("E1807");
    }
  });

  test("each channel has the stated range: `rgb` 0 to 255, `hsl`'s percentages 0 to 100, `oklab`'s `<ab>` -0.5 to 0.5, `oklch`'s `<ch>` 0 to 0.5, `display-p3`'s `<u>` 0 to 1", () => {
    const inside = [
      "rgb(0 255 0)",
      "hsl(0 0% 100%)",
      "oklab(1 -0.5 0.5)",
      "oklab(100% 0.5 -0.5)",
      "oklch(0 0.5 360)",
      "color(display-p3 0 1 0)",
    ];
    const outside = [
      "rgb(0 256 0)",
      "rgb(-1 0 0)",
      "hsl(0 101% 0%)",
      "hsl(0 0 0%)",
      "oklab(0.5 0.51 0)",
      "oklab(0.5 0 -0.51)",
      "oklch(0.5 0.51 0)",
      "oklch(0.5 -0.1 0)",
      "color(display-p3 1.01 0 0)",
      "color(display-p3 0 -0.1 0)",
    ];
    for (const ok of inside) expect(issuesOf({ color: { a: ok } }), ok).toBeNull();
    for (const bad of outside) expect(refusedAt({ color: { a: bad } }, ["color", "a"]), bad).toBe(true);
  });

  test("a form written in range is accepted and one channel past its range is refused, whatever the channels", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        n(0, 0.5, 3),
        n(-0.5, 0.5, 3),
        n(0, 1, 3),
        (r, g, b, ch, ab, u) => {
          const ok = [
            `rgb(${r} ${g} ${b})`,
            `oklch(0.5 ${ch} 120)`,
            `oklab(0.5 ${ab} ${ab})`,
            `color(display-p3 ${u} ${u} ${u})`,
          ];
          const bad = [
            `rgb(${r} ${g} ${256 + b})`,
            `oklch(0.5 ${0.5 + ch + 0.001} 120)`,
            `oklab(0.5 ${0.5 + Math.abs(ab) + 0.001} 0)`,
            `color(display-p3 ${u} ${u} ${1 + u + 0.001})`,
          ];
          for (const v of ok) expect(issuesOf({ color: { a: v } }), v).toBeNull();
          for (const v of bad) expect(refusedAt({ color: { a: v } }, ["color", "a"]), v).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("`shadow: { a: '0 1px 2px rgb(0 0 0 / 0.2)' }` and `overlay: { scrim: { value: '#1a191e99', over: ['card'] } }` with a color token `card` are accepted", () => {
    expect(issuesOf({ shadow: { a: "0 1px 2px rgb(0 0 0 / 0.2)" } })).toBeNull();
    expect(
      issuesOf({ color: { card: "#ffffff" }, overlay: { scrim: { value: "#1a191e99", over: ["card"] } } }),
    ).toBeNull();
    for (const alpha of [
      "rgb(26 25 30 / 0.6)",
      "oklch(54% 0.16 40 / 50%)",
      "color(display-p3 0 0 1 / 0.5)",
      "#1a191e99",
      "#1a19",
    ]) {
      expect(
        issuesOf({ color: { card: "#ffffff" }, overlay: { scrim: { value: alpha, over: ["card"] } } }),
        alpha,
      ).toBeNull();
    }
  });

  test("`overlay: { scrim: { value: '#1a191e', over: ['card'] } }`, one with `over: []`, and one with `over: ['nope']` are each refused with rule `format`", () => {
    const color = { card: "#ffffff" };
    expect(
      refusedAt({ color, overlay: { scrim: { value: "#1a191e", over: ["card"] } } }, ["overlay", "scrim", "value"]),
    ).toBe(true);
    expect(refusedUnder({ color, overlay: { scrim: { value: "#1a191e99", over: [] } } }, "overlay.scrim")).toBe(true);
    expect(
      refusedAt({ color, overlay: { scrim: { value: "#1a191e99", over: ["nope"] } } }, ["overlay", "scrim", "over"]),
    ).toBe(true);
    const overlay = {
      scrim: { value: "#1a191e99", over: ["card", "other"] },
      other: { value: "#00000099", over: ["card"] },
    };
    expect(refusedAt({ color, overlay }, ["overlay", "scrim", "over"])).toBe(true);
    for (const o of [
      { value: "#1a191e", over: ["card"] },
      { value: "#1a191e99", over: [] },
      { value: "#1a191e99", over: ["nope"] },
    ]) {
      expect(codeOf(() => withGroups({ color, overlay: { scrim: o } }))).toBe("E1807");
    }
  });

  test("an alpha color anywhere but a `shadow` or an `overlay` is refused, a `color` token holding one included", () => {
    for (const a of ["#1a191e99", "rgb(0 0 0 / 0.5)", "oklch(54% 0.16 40 / 0.5)"]) {
      expect(refusedAt({ color: { a } }, ["color", "a"]), a).toBe(true);
      expect(issuesOf({ border: { b: `1px solid ${a}` } }), `border ${a}`).not.toBeNull();
    }
  });

  test("an overlay lists 1 to 8 distinct names of color tokens, and a ninth or a repeated name is refused", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (count) => {
        const names = Array.from({ length: count }, (_, i) => `c${i}`);
        const color = Object.fromEntries(names.map((c) => [c, "#ffffff"]));
        const ok = issuesOf({ color, overlay: { s: { value: "#00000099", over: names } } }) === null;
        expect(ok).toBe(count <= 8);
      }),
      { seed: SEED, numRuns: 10 },
    );
    expect(
      refusedUnder({ color: { c: "#ffffff" }, overlay: { s: { value: "#00000099", over: ["c", "c"] } } }, "overlay.s"),
    ).toBe(true);
  });
});

describe("k.values: one luminance per form, computed exactly", () => {
  test("each form's contrast against black is its luminance from the stated formula: `(L + 0.05) / 0.05`", () => {
    // Inside or outside sRGB is computed (a linear channel below 0 or above 1 by more than 0.000001, k.values Contrast), not
    // assumed: `color(display-p3 0.67 0.29 0.1)` has a linear sRGB blue of about -0.0024, so it is outside, and an outside
    // color is judged as the lower of its as-given ratio and its gamut-mapped one: at most the formula's, never above it.
    for (const form of FORMS) {
      const given = (colorLuminance(form) + 0.05) / 0.05;
      const givenOnWhite = 1.05 / (colorLuminance(form) + 0.05);
      if (inSrgb(form)) {
        expect(contrast(form, BLACK), form).toBeCloseTo(given, 2);
        expect(contrast(WHITE, form), form).toBeCloseTo(givenOnWhite, 2);
      } else {
        expect(contrast(form, BLACK), form).toBeLessThanOrEqual(given + 0.005);
        expect(contrast(WHITE, form), form).toBeLessThanOrEqual(givenOnWhite + 0.005);
      }
    }
    expect(FORMS.filter((f) => !inSrgb(f))).toEqual(["color(display-p3 0.67 0.29 0.1)"]);
  });

  test("hex and `rgb()` of one color have one luminance, whatever the channels", () => {
    const hex = (c: number): string => c.toString(16).padStart(2, "0");
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (r, g, b) => {
          const as = `#${hex(r)}${hex(g)}${hex(b)}`;
          expect(contrast(`rgb(${r} ${g} ${b})`, BLACK)).toBeCloseTo(contrast(as, BLACK), 6);
          expect(contrast(`rgb(${r} ${g} ${b})`, WHITE)).toBeCloseTo(colorRatio(as, WHITE), 2);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("`hsl()` through CSS Color 4's `hslToRgb`, whatever the hue, saturation and lightness (the hue bare or with `deg`)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 359 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.boolean(),
        (h, s, l, deg) => {
          const form = `hsl(${h}${deg ? "deg" : ""} ${s}% ${l}%)`;
          expect(contrast(form, BLACK), form).toBeCloseTo((colorLuminance(form) + 0.05) / 0.05, 2);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("`oklab()`, `oklch()` (its hue in degrees) and `color(display-p3 ...)` through CSS Color 4's matrices, for every color inside sRGB", () => {
    fc.assert(
      fc.property(
        n(0, 1, 3),
        n(-0.4, 0.4, 3),
        n(-0.4, 0.4, 3),
        n(0, 0.4, 3),
        n(0, 360, 1),
        n(0, 1, 3),
        n(0, 1, 3),
        n(0, 1, 3),
        (L, a, b, c, h, u, v, w) => {
          const forms = [`oklab(${L} ${a} ${b})`, `oklch(${L} ${c} ${h})`, `color(display-p3 ${u} ${v} ${w})`];
          for (const form of forms.filter((f) => inSrgb(f))) {
            expect(contrast(form, BLACK), form).toBeCloseTo((colorLuminance(form) + 0.05) / 0.05, 2);
            expect(contrast(form, WHITE), form).toBeCloseTo(colorRatio(form, WHITE), 2);
          }
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test("an `oklab()` or `oklch()` lightness written as a percentage is the same color as the fraction", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), n(0, 0.1, 3), n(0, 360, 0), (p, c, h) => {
        expect(contrast(`oklch(${p}% ${c} ${h})`, BLACK)).toBeCloseTo(
          contrast(`oklch(${p / 100} ${c} ${h})`, BLACK),
          6,
        );
        expect(contrast(`oklab(${p}% 0 0)`, BLACK)).toBeCloseTo(contrast(`oklab(${p / 100} 0 0)`, BLACK), 6);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("With color tokens `a` `color(display-p3 0 0 1)` and `b` `#000000`, the pair is judged at 2.44:1, the ratio after mapping to sRGB, which is below the 2.59:1 of the color as given", () => {
    const form = "color(display-p3 0 0 1)";
    expect(inSrgb(form)).toBe(false);
    expect(colorRatio(form, BLACK).toFixed(2)).toBe("2.59");
    expect(contrast(form, BLACK)).toBeCloseTo(2.44, 2);
    expect(contrast(BLACK, form)).toBeCloseTo(2.44, 2);
    expect(contrast(form, BLACK)).toBeLessThan(colorRatio(form, BLACK));
  });

  test("no pair is judged above its as-given ratio, and an in-sRGB pair is judged at exactly it", () => {
    fc.assert(
      fc.property(n(0, 1, 3), n(0, 1, 3), n(0, 1, 3), fc.constantFrom(BLACK, WHITE, "#777777"), (u, v, w, other) => {
        const form = `color(display-p3 ${u} ${v} ${w})`;
        const given = colorRatio(form, other);
        const judged = contrast(form, other);
        expect(judged).toBeLessThanOrEqual(given + 0.005);
        if (inSrgb(form)) expect(judged).toBeCloseTo(given, 2);
      }),
      { seed: SEED, numRuns: 80 },
    );
    expect(colorLinear("#ffffff").map((c) => Math.round(c * 1000))).toEqual([1000, 1000, 1000]);
  });
});
