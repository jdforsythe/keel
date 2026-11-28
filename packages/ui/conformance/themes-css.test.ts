// @vitest-environment happy-dom
// Spec: k.schemes, clause "With the first case's tokens and `themes: { slate: { color: { fg: '#222222' } } }`, the CSS opens with `@layer keel.tokens,keel.theme,keel.contrast,keel.print;`, the first case's blocks sit in `@layer keel.tokens`, and `@layer keel.theme` holds `:root[data-k-theme=\"slate\"]` declaring `--k-color-fg:#222222`; with `slate`'s `fg` `{ light: '#222222', dark: '#dddddd' }`, it also holds `:root[data-k-theme=\"slate\"]:not([data-k-scheme=\"light\"])` declaring `--k-color-fg:#dddddd` under `@media screen and (prefers-color-scheme: dark)`."
// Spec: k.schemes, clause "`themes: { hc: { when: 'contrast', color: { fg: '#000000' } } }` puts `:root` declaring `--k-color-fg:#000000` under `@media (prefers-contrast: more)` in `@layer keel.contrast`, and `themes: { paper: { when: 'print', color: { bg: '#ffffff' } } }` puts `:root` declaring `color-scheme:light`, `print-color-adjust:exact` and `--k-color-bg:#ffffff` under `@media print` in `@layer keel.print`; in each, every rule declaring `--k-color-fg:#eeeeee` is under an `@media` whose query starts `screen`, and no `data-k-theme` is written."
// Spec: k.aria, clause "With color tokens `fg` `{ light: '#111111', dark: '#eeeeee' }` and `bg` `{ light: '#ffffff', dark: '#111111' }`, `<Box id=\"side\" scheme=\"dark\">` renders `data-k-scheme=\"dark\"` on its element in server and client output and the CSS holds `:root [data-k-scheme=\"dark\"]` declaring `color-scheme:dark` and `--k-color-fg:#eeeeee` under `@media screen`; with no `scheme` written, the CSS holds no ` [data-k-scheme=`; `compileStyles({ tokens, usages: [{ props: { scheme: 'dark' } }] })` gives `classes` `[[]]` and CSS holding `:root [data-k-scheme=\"light\"]` and `:root [data-k-scheme=\"dark\"]` under `@media screen`; with `brandTokens`, `<Box scheme=\"dark\">` is one E1814 at the attribute with message `scheme=\"dark\" needs schemes light and dark; the tokens have light only`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: tokens are written through `compileWith` (base-support.ts), which passes plain data to `defineTokens`, so `themes` type-checks before `Tokens` names it. A block is read in the whitespace-normal form of fixtures.ts `norm` (`@media screen and (prefers-color-scheme: dark)` reads `@media screen and(prefers-color-scheme:dark)`). A layer is read with `layerBody` (base-support.ts), a rule's enclosing blocks with `enclosing`. An element that writes `scheme` reaches `compileStyles` as a usage `{ props: { scheme: "dark" } }` (k.aria Scheme: `compileStyles` takes each such element as that usage, whose `classes` entry is `[]`).
// k.aria Scheme, the E1814 half (`brandTokens` with one scheme) is packages/check/conformance/scheme-subtree-e1814.test.ts. "In server and client output" is read from the node `Box` builds (its outerHTML, the server HTML as scheme-select.test.ts reads it) and from the mounted element.
// Needs a real browser: that the layers order as written, that `getComputedStyle` shows the theme's value under an emulated dark or contrast preference, and that print drops every dark value are end-to-end cases (RFC 0244's runner).
import { Box } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileWith, enclosing, layerBody, ruleBody } from "./base-support.ts";
import { SEED, mediaBlocks, norm, withoutMedia } from "./fixtures.ts";
import { byId, cleanup, render } from "./roles-support.ts";

const FG = { light: "#111111", dark: "#eeeeee" };
const BG = { light: "#ffffff", dark: "#111111" };
const color = { fg: FG, bg: BG };
const css = (themes: Record<string, unknown> | undefined, usages: readonly Record<string, unknown>[] = []): string =>
  compileWith({ color, ...(themes === undefined ? {} : { themes }) }, usages).css;
const LAYERS = "@layer keel.tokens,keel.theme,keel.contrast,keel.print;";
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);

describe("k.schemes: themes in layers", () => {
  const outOf = () => css({ slate: { color: { fg: "#222222" } } });
  const pairOf = () => css({ slate: { color: { fg: { light: "#222222", dark: "#dddddd" } } } });

  test("With the first case's tokens and `themes: { slate: { color: { fg: '#222222' } } }`, the CSS opens with `@layer keel.tokens,keel.theme,keel.contrast,keel.print;`", () => {
    expect(norm(outOf()).trimStart().startsWith(LAYERS)).toBe(true);
  });

  test("the first case's blocks sit in `@layer keel.tokens`", () => {
    const tokens = layerBody(outOf(), "keel.tokens") ?? "";
    const root = ruleBody(withoutMedia(tokens), ":root") ?? "";
    expect(root).toContain("color-scheme:light dark");
    expect(root).toContain("--k-color-fg:#111111");
    const media = mediaBlocks(tokens, "prefers-color-scheme:dark");
    expect(media).toHaveLength(1);
    expect(ruleBody(media[0] ?? "", ':root:not([data-k-scheme="light"])') ?? "").toContain("--k-color-fg:#eeeeee");
    // k.schemes CSS: `S[data-k-scheme="dark"]` sits under `screen` and `M` (bare for the top level), never outside an `@media`.
    const screen = mediaBlocks(tokens, "screen").join("");
    expect(ruleBody(screen, ':root[data-k-scheme="dark"]') ?? "").toContain("color-scheme:dark");
    expect(ruleBody(withoutMedia(tokens), ':root[data-k-scheme="dark"]')).toBeNull();
    expect(layerBody(outOf(), "keel.theme") ?? "").not.toContain("#111111");
  });

  test('`@layer keel.theme` holds `:root[data-k-theme="slate"]` declaring `--k-color-fg:#222222`', () => {
    const theme = layerBody(outOf(), "keel.theme") ?? "";
    expect(ruleBody(withoutMedia(theme), ':root[data-k-theme="slate"]') ?? "").toContain("--k-color-fg:#222222");
  });

  test("with `slate`'s `fg` `{ light: '#222222', dark: '#dddddd' }`, `@layer keel.theme` also holds `:root[data-k-theme=\"slate\"]:not([data-k-scheme=\"light\"])` declaring `--k-color-fg:#dddddd` under `@media screen and (prefers-color-scheme: dark)`", () => {
    const theme = layerBody(pairOf(), "keel.theme") ?? "";
    expect(ruleBody(withoutMedia(theme), ':root[data-k-theme="slate"]') ?? "").toContain("--k-color-fg:#222222");
    expect(norm(theme)).toContain("@media screen and(prefers-color-scheme:dark){");
    const media = mediaBlocks(theme, "screen and(prefers-color-scheme:dark)");
    expect(media).toHaveLength(1);
    expect(ruleBody(media[0] ?? "", ':root[data-k-theme="slate"]:not([data-k-scheme="light"])') ?? "").toContain(
      "--k-color-fg:#dddddd",
    );
  });

  test('the pair\'s dark value also sits under `@media screen` in `:root[data-k-theme="slate"][data-k-scheme="dark"]` with `color-scheme:dark` first', () => {
    const theme = layerBody(pairOf(), "keel.theme") ?? "";
    const screen = mediaBlocks(theme, "screen").filter((b) => b.includes('[data-k-scheme="dark"]'));
    expect(screen.length).toBeGreaterThan(0);
    const rule = ruleBody(screen.join(""), ':root[data-k-theme="slate"][data-k-scheme="dark"]') ?? "";
    expect(rule.startsWith("color-scheme:dark")).toBe(true);
    expect(rule).toContain("--k-color-fg:#dddddd");
  });

  test("with no `themes`, the top-level blocks are unlayered and no `data-k-theme` is written", () => {
    const none = css(undefined);
    expect(norm(none)).not.toContain("@layer keel.tokens");
    expect(none).not.toContain("data-k-theme");
    expect(none).not.toContain("keel.theme");
  });

  test("whatever the theme's light and dark values, each one is written once under its theme selector and the theme's dark value never outside a `screen` block", () => {
    fc.assert(
      fc.property(hex, hex, (light, dark) => {
        fc.pre(light !== dark && ![FG.light, FG.dark, BG.light, BG.dark].includes(dark));
        const c = css({ slate: { color: { fg: { light, dark } } } });
        const theme = layerBody(c, "keel.theme") ?? "";
        expect(ruleBody(withoutMedia(theme), ':root[data-k-theme="slate"]') ?? "").toContain(`--k-color-fg:${light}`);
        const stacks = enclosing(c, `--k-color-fg:${dark}`);
        expect(stacks.length).toBeGreaterThan(0);
        for (const s of stacks) expect(s.some((p) => p.startsWith("@media screen"))).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.schemes: contrast and print themes", () => {
  const hcOf = () => css({ hc: { when: "contrast", color: { fg: "#000000" } } });
  const paperOf = () => css({ paper: { when: "print", color: { bg: "#ffffff" } } });

  test("`themes: { hc: { when: 'contrast', color: { fg: '#000000' } } }` puts `:root` declaring `--k-color-fg:#000000` under `@media (prefers-contrast: more)` in `@layer keel.contrast`", () => {
    const layer = layerBody(hcOf(), "keel.contrast") ?? "";
    const blocks = mediaBlocks(layer, "(prefers-contrast:more)");
    expect(blocks).toHaveLength(1);
    expect(ruleBody(blocks[0] ?? "", ":root") ?? "").toContain("--k-color-fg:#000000");
    expect(norm(layer)).toContain("@media(prefers-contrast:more){");
  });

  test("`themes: { paper: { when: 'print', color: { bg: '#ffffff' } } }` puts `:root` declaring `color-scheme:light`, `print-color-adjust:exact` and `--k-color-bg:#ffffff` under `@media print` in `@layer keel.print`", () => {
    const layer = layerBody(paperOf(), "keel.print") ?? "";
    expect(norm(layer)).toContain("@media print{");
    const root = ruleBody(mediaBlocks(layer, "print").join(""), ":root") ?? "";
    expect(root).toContain("color-scheme:light");
    expect(root).toContain("print-color-adjust:exact");
    expect(root).toContain("-webkit-print-color-adjust:exact");
    expect(root).toContain("--k-color-bg:#ffffff");
    expect(root.startsWith("color-scheme:light;print-color-adjust:exact;-webkit-print-color-adjust:exact")).toBe(true);
  });

  test("in each, every rule declaring `--k-color-fg:#eeeeee` is under an `@media` whose query starts `screen`, and no `data-k-theme` is written", () => {
    for (const c of [hcOf(), paperOf()]) {
      const stacks = enclosing(c, "--k-color-fg:#eeeeee");
      expect(stacks.length).toBeGreaterThan(0);
      for (const s of stacks) expect(s.some((p) => p.startsWith("@media screen"))).toBe(true);
      expect(c).not.toContain("data-k-theme");
    }
  });

  test("a `contrast` or `print` theme writes no pair-dark or subtree block of its own, whatever the colors it re-values", () => {
    fc.assert(
      fc.property(fc.constantFrom("contrast", "print"), hex, (when, v) => {
        const c = css({ t: { when, color: { fg: v } } });
        const layer = layerBody(c, when === "contrast" ? "keel.contrast" : "keel.print") ?? "";
        expect(layer).toContain(`--k-color-fg:${v}`);
        expect(layer).not.toContain("data-k-scheme");
        expect(c).not.toContain("data-k-theme");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

describe("k.aria: Scheme", () => {
  const usages = [{ props: { scheme: "dark" } }];

  test('`<Box id="side" scheme="dark">` renders `data-k-scheme="dark"` on its element in server and client output', () => {
    let server = "";
    const { host, off } = render(() => {
      const n = Box({ id: "side", scheme: "dark" });
      if (!(n instanceof Element)) throw new Error("fixture: Box returned no element");
      server = n.outerHTML;
      return n;
    });
    expect(server).toContain('data-k-scheme="dark"');
    expect(byId(host, "side").getAttribute("data-k-scheme")).toBe("dark");
    off();
    cleanup();
  });

  test('the CSS holds `:root [data-k-scheme="dark"]` declaring `color-scheme:dark` and `--k-color-fg:#eeeeee` under `@media screen`', () => {
    const out = css(undefined, usages);
    const screen = mediaBlocks(out, "screen").join("");
    const rule = ruleBody(screen, ':root [data-k-scheme="dark"]') ?? "";
    expect(rule).toContain("color-scheme:dark");
    expect(rule).toContain("--k-color-fg:#eeeeee");
    expect(ruleBody(screen, ':root [data-k-scheme="light"]') ?? "").toContain("--k-color-fg:#111111");
    expect(ruleBody(withoutMedia(out), ':root [data-k-scheme="dark"]')).toBeNull();
  });

  test('`compileStyles({ tokens, usages: [{ props: { scheme: \'dark\' } }] })` gives `classes` `[[]]` and CSS holding `:root [data-k-scheme="light"]` and `:root [data-k-scheme="dark"]` under `@media screen`', () => {
    const { classes, css: out } = compileWith({ color }, usages);
    expect(classes).toEqual([[]]);
    const screen = mediaBlocks(out, "screen").join("");
    expect(ruleBody(screen, ':root [data-k-scheme="light"]') ?? "").toContain("color-scheme:light");
    expect(ruleBody(screen, ':root [data-k-scheme="dark"]') ?? "").toContain("color-scheme:dark");
  });

  test('any element writing `scheme` turns on the subtree blocks in every layer but `print`: `:root [data-k-scheme="dark"]` at the top level and under `contrast`, `:root[data-k-theme="slate"] [data-k-scheme="dark"]` in the `choice` theme `slate`, none in `keel.print`', () => {
    const out = css(
      {
        slate: { color: { fg: "#222222" } },
        hc: { when: "contrast", color: { fg: "#000000" } },
        paper: { when: "print", color: { bg: "#ffffff" } },
      },
      usages,
    );
    const at = (layer: string): string => layerBody(out, layer) ?? "";
    expect(at("keel.tokens")).toContain(':root [data-k-scheme="dark"]');
    expect(at("keel.theme")).toContain(':root[data-k-theme="slate"] [data-k-scheme="dark"]');
    expect(at("keel.contrast")).toContain(':root [data-k-scheme="dark"]');
    expect(at("keel.print")).not.toContain("data-k-scheme");
    for (const layer of ["keel.tokens", "keel.theme", "keel.contrast"]) {
      for (const stack of enclosing(at(layer), ' [data-k-scheme="dark"]{')) {
        expect(
          stack.some((p) => p.startsWith("@media screen")),
          layer,
        ).toBe(true);
      }
    }
  });

  test("with no `scheme` written, the CSS holds no ` [data-k-scheme=`", () => {
    expect(css(undefined)).not.toContain(" [data-k-scheme=");
    expect(css(undefined, [{ props: { p: "2" } }])).not.toContain(" [data-k-scheme=");
  });

  test("whatever the pair, a written `scheme` re-declares both values in its subtree block, each once under `screen`", () => {
    fc.assert(
      fc.property(hex, hex, (light, dark) => {
        fc.pre(light !== dark);
        const out = compileWith({ color: { fg: { light, dark } } }, usages).css;
        const screen = mediaBlocks(out, "screen").join("");
        expect(ruleBody(screen, ':root [data-k-scheme="dark"]') ?? "").toContain(`--k-color-fg:${dark}`);
        expect(ruleBody(screen, ':root [data-k-scheme="light"]') ?? "").toContain(`--k-color-fg:${light}`);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
