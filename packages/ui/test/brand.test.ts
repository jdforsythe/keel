// @keel/ui/brand and @keel/ui/fonts (docs/BRAND.md 2-4, 6). Seed 1337.
import fs from "node:fs";
import path from "node:path";
import { TokenSchema } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles, contrast } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const FONTS = path.join(import.meta.dirname, "..", "fonts");
const color = brandTokens.color;
type ColorName = keyof typeof color;
const names = Object.keys(color).filter((n): n is ColorName => n in color);
/** Text colors the brand sets on its surfaces (fg on bg); every pair must pass E1804's 4.5:1. */
const TEXT: readonly ColorName[] = ["text", "textSecondary", "accent", "verified", "error"];
const SURFACES: readonly ColorName[] = ["surface", "surfaceLow", "card"];

describe("brandTokens", () => {
  it("passes TokenSchema", () => {
    expect(TokenSchema.parse(brandTokens).ok).toBe(true);
  });

  it("carries the BRAND.md palette, fonts, zero radius and the hairline divider", () => {
    expect(color).toEqual({
      surface: "#F9F9F9",
      surfaceLow: "#F3F3F3",
      card: "#FFFFFF",
      text: "#1a191e",
      textSecondary: "#6B6B74",
      accent: "#b8420d",
      verified: "#15803D",
      error: "#B91C1C",
      divider: "#E4E4E7",
    });
    expect(brandTokens.font.serif).toBe('"Source Serif 4", Georgia, serif');
    expect(brandTokens.font.mono).toBe('"JetBrains Mono", ui-monospace, monospace');
    expect(Object.values(brandTokens.radius)).toEqual(["0"]);
    expect(brandTokens.border.hairline).toBe("1px solid var(--k-color-divider)");
    expect(brandTokens.size.hairline).toBe("1px");
  });

  it("every brand text color on every brand surface passes 4.5:1", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT), fc.constantFrom(...SURFACES), (fg, bg) => {
        expect(contrast(color[fg], color[bg])).toBeGreaterThanOrEqual(4.5);
      }),
      { seed: 1337, numRuns: 50 },
    );
    for (const bg of ["accent", "verified", "error", "text"] as const)
      expect(contrast(color.card, color[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("every border names a color custom property that :root defines", () => {
    const { css } = compileStyles({
      tokens: brandTokens,
      usages: Object.keys(brandTokens.border).map((b) => ({ props: { border: b } })),
    });
    for (const n of names) expect(css).toContain(`--k-color-${n}:${color[n]}`);
    const used = [...css.matchAll(/var\((--k-color-[A-Za-z0-9]+)\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const v of used) expect(css).toContain(`${v}:#`);
    expect(css).toContain(".k-border-hairline{border:var(--k-border-hairline)}");
    expect(css).not.toContain("prefers-color-scheme");
  });
});

describe("@keel/ui/fonts", () => {
  const css = fs.readFileSync(path.join(FONTS, "fonts.css"), "utf8");

  it("sets only the document surface besides the faces: the surface token, no body margin", () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*\{[^}]*\}/g, "");
    const compact = rules.replace(/\s+/g, "");
    expect(compact).toBe("html{background-color:var(--k-color-surface,#f9f9f9);}body{margin:0;}");
  });

  it("declares both brand faces with font-display swap from same-origin relative URLs", () => {
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.map((f) => /font-family:\s*"([^"]+)"/.exec(f)?.[1])).toEqual(["Source Serif 4", "JetBrains Mono"]);
    for (const f of faces) expect(f).toContain("font-display: swap;");
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1] ?? "");
    expect(urls).toHaveLength(2);
    for (const u of urls) {
      expect(u).toMatch(/^\.\/[\w-]+\.woff2$/);
      expect(fs.existsSync(path.join(FONTS, u))).toBe(true);
    }
  });

  it("ships only woff2 faces, their OFL licenses and the CSS, under 600 KB", () => {
    const files = fs.readdirSync(FONTS).sort();
    expect(files).toEqual([
      "JetBrainsMono-Variable.woff2",
      "LICENSE-JetBrainsMono.txt",
      "LICENSE-SourceSerif4.md",
      "SourceSerif4Variable-Roman.woff2",
      "fonts.css",
    ]);
    const total = files.reduce((n, f) => n + fs.statSync(path.join(FONTS, f)).size, 0);
    expect(total).toBeLessThan(600 * 1024);
    for (const l of files.filter((f) => f.startsWith("LICENSE")))
      expect(fs.readFileSync(path.join(FONTS, l), "utf8")).toContain("SIL Open Font License, Version 1.1");
    for (const w of files.filter((f) => f.endsWith(".woff2")))
      expect(fs.readFileSync(path.join(FONTS, w)).subarray(0, 4).toString("latin1")).toBe("wOF2");
  });
});
