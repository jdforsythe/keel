// Spec: k.schemes, clause "With color tokens `fg` `{ light: '#111111', dark: '#eeeeee' }` and `bg` `{ light: '#ffffff', dark: '#111111' }` and no `schemes`, the CSS's `:root` block declares `color-scheme:light dark` and `--k-color-fg:#111111`, a `@media screen and (prefers-color-scheme: dark)` block holds `:root:not([data-k-scheme=\"light\"])` declaring `--k-color-fg:#eeeeee`, and a `@media screen` block holds a `:root[data-k-scheme=\"dark\"]` rule declaring `color-scheme:dark` and `--k-color-fg:#eeeeee`."
// Spec: k.schemes, clause "With those tokens and `schemes: ['light']`, the CSS's `:root` declares `color-scheme:light` and `--k-color-fg:#111111` and the CSS holds no `prefers-color-scheme` and no `data-k-scheme`; with `schemes: ['dark']`, `:root` declares `color-scheme:dark` and `--k-color-fg:#eeeeee`."
// Spec: k.schemes, clause "`schemes: ['light', 'light']`, `schemes: ['sepia']` and `schemes: []` are each one E1807."
// Spec: k.schemes, clause "With `brandTokens` composing a library's color `acme.x` `{ light: '#111111', dark: '#eeeeee' }` (k.looks) and no `schemes`, the CSS holds no `prefers-color-scheme`."
// Seed: 1337 (fc.assert below). The E1807 half reads `defineTokens` and `TokenSchema.parse`, as rules-e1801-e1807-codes-0065.test.ts does for the other E1807 causes.
// ASSUMPTIONS: a "block" is read in the whitespace-normal form of fixtures.ts `norm`; the `:root` block is the first `:root{...}` rule outside every `@media`; "holds no `prefers-color-scheme`" is the substring test on the whole CSS.
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, compileWith, withGroups } from "./base-support.ts";
import { SEED, mediaBlocks, norm, withoutMedia } from "./fixtures.ts";
import { ruleBody } from "./base-support.ts";

const FG = { light: "#111111", dark: "#eeeeee" };
const BG = { light: "#ffffff", dark: "#111111" };
const color = { fg: FG, bg: BG };
const css = (extra: Record<string, unknown>): string => compileWith({ color, ...extra }, []).css;

describe("k.schemes: the compiled CSS opens with the scheme custom properties", () => {
  test('with color tokens `fg` and `bg` as pairs and no `schemes`, `:root` declares `color-scheme:light dark` and the light values, the media block holds `:root:not([data-k-scheme="light"])` with the dark values, and `:root[data-k-scheme="dark"]` declares `color-scheme:dark` and them too', () => {
    const out = css({});
    const root = ruleBody(withoutMedia(out), ":root") ?? "";
    expect(root).toContain("color-scheme:light dark");
    expect(root).toContain("--k-color-fg:#111111");
    expect(root).not.toContain("#eeeeee");
    const media = mediaBlocks(out, "screen and(prefers-color-scheme:dark)");
    expect(media).toHaveLength(1);
    expect(norm(out)).toContain("@media screen and(prefers-color-scheme:dark){");
    const inMedia = ruleBody(media[0] ?? "", ':root:not([data-k-scheme="light"])') ?? "";
    expect(inMedia).toContain("--k-color-fg:#eeeeee");
    const screen = mediaBlocks(out, "screen").filter((b) => b.includes(':root[data-k-scheme="dark"]'));
    expect(screen.length).toBeGreaterThan(0);
    const dark = ruleBody(screen.join(""), ':root[data-k-scheme="dark"]') ?? "";
    expect(dark).toContain("color-scheme:dark");
    expect(dark).toContain("--k-color-fg:#eeeeee");
    expect(ruleBody(withoutMedia(out), ':root[data-k-scheme="dark"]')).toBeNull();
  });

  test('both schemes: the media block is `@media screen and (prefers-color-scheme: dark)`, the attribute rule sits under `@media screen`, and `:root[data-k-scheme="light"]` declares `color-scheme:light` in a rule of its own, after the dark ones', () => {
    const out = norm(css({}));
    const light = ruleBody(withoutMedia(out), ':root[data-k-scheme="light"]') ?? "";
    expect(light).toContain("color-scheme:light");
    expect(light).not.toContain("--k-color");
    expect(out.indexOf("@media screen and(prefers-color-scheme:dark)")).toBeGreaterThanOrEqual(0);
    expect(out.indexOf(':root[data-k-scheme="dark"]')).toBeGreaterThan(
      out.indexOf("@media screen and(prefers-color-scheme:dark)"),
    );
    expect(out.indexOf("@media screen{")).toBeLessThan(out.indexOf(':root[data-k-scheme="dark"]'));
  });

  test("whatever the two values of each pair, both schemes put every light value in `:root` and every dark value in the media block and in the dark attribute rule", () => {
    const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
    fc.assert(
      fc.property(fc.uniqueArray(hex, { minLength: 4, maxLength: 4 }), (v) => {
        const [a = "", b = "", c = "", d = ""] = v;
        const out = compileWith({ color: { fg: { light: a, dark: b }, bg: { light: c, dark: d } } }, []).css;
        const root = ruleBody(withoutMedia(out), ":root") ?? "";
        expect(root).toContain(`--k-color-fg:${a}`);
        expect(root).toContain(`--k-color-bg:${c}`);
        const media = mediaBlocks(out, "prefers-color-scheme:dark").join("");
        const attr = ruleBody(mediaBlocks(out, "screen").join(""), ':root[data-k-scheme="dark"]') ?? "";
        for (const body of [media, attr]) {
          expect(body).toContain(`--k-color-fg:${b}`);
          expect(body).toContain(`--k-color-bg:${d}`);
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.schemes: one scheme", () => {
  test("with `schemes: ['light']`, `:root` declares `color-scheme:light` and `--k-color-fg:#111111` and the CSS holds no `prefers-color-scheme` and no `data-k-scheme`", () => {
    const out = css({ schemes: ["light"] });
    const root = ruleBody(norm(out), ":root") ?? "";
    expect(root).toContain("color-scheme:light");
    expect(root).not.toContain("color-scheme:light dark");
    expect(root).toContain("--k-color-fg:#111111");
    expect(out).not.toContain("prefers-color-scheme");
    expect(out).not.toContain("data-k-scheme");
  });

  test("with `schemes: ['dark']`, `:root` declares `color-scheme:dark` and `--k-color-fg:#eeeeee`, and the CSS holds no `prefers-color-scheme` and no `data-k-scheme`", () => {
    const out = css({ schemes: ["dark"] });
    const root = ruleBody(norm(out), ":root") ?? "";
    expect(root).toContain("color-scheme:dark");
    expect(root).toContain("--k-color-fg:#eeeeee");
    expect(root).not.toContain("#111111;--k-color-fg");
    expect(out).not.toContain("prefers-color-scheme");
    expect(out).not.toContain("data-k-scheme");
  });

  test("a string color gives its one value in the one scheme and in both, and a pair's value for a scheme the app lacks is unused", () => {
    fc.assert(
      fc.property(fc.constantFrom(["light"], ["dark"], ["light", "dark"]), (schemes) => {
        const out = compileWith({ color: { ink: "#123456", fg: FG, bg: BG }, schemes }, []).css;
        expect(ruleBody(withoutMedia(out), ":root") ?? "").toContain("--k-color-ink:#123456");
        const dark = mediaBlocks(out, "prefers-color-scheme:dark").join("");
        expect(dark.includes("--k-color-ink")).toBe(false);
        if (schemes.length === 1) expect(out).not.toContain(schemes[0] === "light" ? "#eeeeee" : "#ffffff");
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});

describe("k.schemes: E1807 on `schemes`", () => {
  const bad = [["light", "light"], ["sepia"], []];
  for (const schemes of bad) {
    test(`\`schemes: ${JSON.stringify(schemes).replace(/"/g, "'")}\` is one E1807`, () => {
      expect(codeOf(() => withGroups({ color, schemes }))).toBe("E1807");
    });
  }

  test("any `schemes` that is not `['light']`, `['dark']` or `['light', 'dark']` fails `TokenSchema`, and these three pass", () => {
    const word = fc.constantFrom("light", "dark", "sepia", "", "Light");
    fc.assert(
      fc.property(fc.array(word, { maxLength: 3 }), (schemes) => {
        const valid = [["light"], ["dark"], ["light", "dark"]].some((s) => s.join() === schemes.join());
        const parsed = codeOf(() => withGroups({ color, schemes }));
        expect(parsed === null).toBe(valid);
        if (!valid) expect(parsed).toBe("E1807");
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("k.schemes: a library's pairs never turn an app half dark", () => {
  test("with `brandTokens` composing a library's color `acme.x` `{ light: '#111111', dark: '#eeeeee' }` and no `schemes`, the CSS holds no `prefers-color-scheme`", () => {
    const tokens = defineTokens({
      ...brandTokens,
      color: { ...brandTokens.color, "acme.x": { light: "#111111", dark: "#eeeeee" } },
    });
    const out = compileStyles({ tokens, usages: [] }).css;
    expect(out).toContain("--k-color-acme-x");
    expect(out).not.toContain("prefers-color-scheme");
    expect(out).not.toContain("data-k-scheme");
  });

  test("an app's own pair, beside a library's, still gives both schemes", () => {
    const tokens = defineTokens({
      ...brandTokens,
      color: { ...brandTokens.color, "acme.x": "#111111", mine: { light: "#111111", dark: "#eeeeee" } },
    });
    expect(compileStyles({ tokens, usages: [] }).css).toContain("prefers-color-scheme");
  });
});
