// Spec: k.aria, clause "With `brandTokens`, `<Box p={{ base: '3', print: '0' }} direction=\"column\">` puts a rule declaring `padding:var(--k-space-0)` in an `@media print` block after the `@media (min-width: 1024px)` block; a `breakpoint` token `print` is one E1807; `<Box media=\"screen\">` has class `k-media-screen` and `keel.base` holds `@media print{.k-media-screen{display:none!important}}`, and with no `media` written the CSS holds no `k-media-`; `breakInside=\"avoid\"` compiles to `break-inside:avoid`, and `breakInside=\"page\"` is a type error."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: `<Box p={{ base: '3', print: '0' }} direction="column">` reaches `compileStyles` as the usages of look-classes and responsive-media: `{ props: { p: "3", direction: "column" } }` for `base` and `{ props: { p: "0" }, breakpoint: "print" }` for the `print` key, beside `{ breakpoint: <the largest brandTokens breakpoint> }` so the `(min-width: 1024px)` block exists (k.ui Base names `lg` 1024px; it is read from `brandTokens.breakpoint`, not written). `<Box media="screen">` is the usage `{ props: { media: "screen" } }` and gives a class `k-media-screen` in `classes`. A rule is read in the whitespace-normal form of fixtures.ts `norm`.
// The `breakpoint` token `print` is one E1807 as `defineTokens` throws it (themes-schema.test.ts reads E1807 the same way); `keel check`'s E1807 half is packages/check/conformance/print-props-e1807.test.ts. The type-error half (`breakInside="page"`) is print-props-types.test-d.ts, asserted by `tsc --noEmit` over `conformance/` with `expectTypeOf`, no suppression comment.
// Needs a real browser: that `print` wins at any paper width and that `media="screen"` elements are absent from a printed PDF and `breakBefore="page"` starts a page are end-to-end cases (RFC 0244's runner).
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { baseLayer, codeOf, outsideBaseLayer, withGroups } from "./base-support.ts";
import { SEED, norm } from "./fixtures.ts";

const widest = (): [string, string] => {
  const bp: Record<string, string> = { ...brandTokens.breakpoint };
  const sorted = Object.entries(bp).sort((a, b) => Number.parseFloat(a[1]) - Number.parseFloat(b[1]));
  const last = sorted[sorted.length - 1];
  if (last === undefined) throw new Error("fixture: brandTokens holds no breakpoint");
  return last;
};
const compile = (usages: readonly { props: Record<string, string>; breakpoint?: string }[]) =>
  compileStyles(JSON.parse(JSON.stringify({ tokens: brandTokens, usages })));

describe("k.aria: Print", () => {
  test("With `brandTokens`, `<Box p={{ base: '3', print: '0' }} direction=\"column\">` puts a rule declaring `padding:var(--k-space-0)` in an `@media print` block after the `@media (min-width: 1024px)` block", () => {
    const [name, width] = widest();
    expect(width).toBe("1024px");
    const { css } = compile([
      { props: { p: "3", direction: "column" } },
      { props: { p: "5" }, breakpoint: name },
      { props: { p: "0" }, breakpoint: "print" },
    ]);
    const n = norm(css);
    const min = n.indexOf("@media(min-width:1024px){");
    const print = n.indexOf("@media print{");
    expect(min).toBeGreaterThanOrEqual(0);
    expect(print).toBeGreaterThan(min);
    const body = n.slice(n.indexOf("{", print) + 1, n.indexOf("}}", print));
    expect(body).toContain("padding:var(--k-space-0)");
  });

  test("the `print` rule sits after every breakpoint block, whatever the breakpoint it follows and the value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(brandTokens.breakpoint)),
        fc.constantFrom("0", "1", "2", "3"),
        (bp, v) => {
          const { css } = compile([
            { props: { p: "3" } },
            { props: { p: "5" }, breakpoint: bp },
            { props: { p: v }, breakpoint: "print" },
          ]);
          const n = norm(outsideBaseLayer(css));
          const media = [...n.matchAll(/@media([^{]*)\{/g)].map((m) => m[1] ?? "");
          const last = media.lastIndexOf("print");
          expect(last).toBeGreaterThanOrEqual(0);
          expect(media.slice(last + 1).filter((m) => m.includes("min-width"))).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a `breakpoint` token `print` is one E1807", () => {
    expect(codeOf(() => withGroups({ breakpoint: { print: "600px" } }))).toBe("E1807");
    expect(codeOf(() => withGroups({ breakpoint: { printer: "600px" } }))).toBeNull();
  });

  test('`<Box media="screen">` has class `k-media-screen` and `keel.base` holds `@media print{.k-media-screen{display:none!important}}`', () => {
    const { classes, css } = compile([{ props: { media: "screen" } }]);
    expect(classes[0]).toContain("k-media-screen");
    const base = baseLayer(css) ?? "";
    expect(base).toContain("@media print{.k-media-screen{display:none!important}}");
    expect(base).toContain("@media screen{.k-media-print{display:none!important}}");
  });

  test('`media="print"` has class `k-media-print` and shows in print only', () => {
    const { classes, css } = compile([{ props: { media: "print" } }]);
    expect(classes[0]).toContain("k-media-print");
    expect(baseLayer(css) ?? "").toContain("@media screen{.k-media-print{display:none!important}}");
  });

  test("with no `media` written, the CSS holds no `k-media-`", () => {
    expect(compile([{ props: { p: "2" } }]).css).not.toContain("k-media-");
    expect(compile([]).css).not.toContain("k-media-");
  });

  test('`breakInside="avoid"` compiles to `break-inside:avoid`, and `breakBefore` and `breakAfter` take `page` or `avoid`', () => {
    expect(norm(compile([{ props: { breakInside: "avoid" } }]).css)).toContain("break-inside:avoid");
    fc.assert(
      fc.property(fc.constantFrom("page", "avoid"), (v) => {
        expect(norm(compile([{ props: { breakBefore: v } }]).css)).toContain(`break-before:${v}`);
        expect(norm(compile([{ props: { breakAfter: v } }]).css)).toContain(`break-after:${v}`);
      }),
      { seed: SEED, numRuns: 4 },
    );
  });

  test('`breakInside="page"` is refused at build, as an unknown value', () => {
    expect(() => compile([{ props: { breakInside: "page" } }])).toThrow();
  });
});
