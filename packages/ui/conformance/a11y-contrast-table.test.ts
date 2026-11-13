// Spec: k.a11y, Conformance "`contrastTable(tokens)` has one entry per ordered pair of distinct color tokens per scheme, each ratio WCAG's to two decimals."
// Seed: 1337.
// Assumed (spec names no entry shape): `contrastTable(tokens)` returns an array of `{ scheme: 'light' | 'dark', fg: string, bg: string, ratio: number }`,
// `fg` and `bg` being color token names; a color given as a single value counts in both schemes.
import { contrastTable, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, ratio, tokens } from "./fixtures.ts";

const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const names = ["a", "b", "c", "d", "e"] as const;

describe("k.a11y: contrastTable(tokens)", () => {
  it.skip("has one entry per ordered pair of distinct color tokens per scheme", () => {
    const rows = contrastTable(tokens);
    // the k.ui tokens have three color tokens: fg, bg, accent
    expect(rows).toHaveLength(3 * 2 * 2);
    const keys = rows.map((r) => `${r.scheme}:${r.fg}:${r.bg}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.every((r) => r.fg !== r.bg)).toBe(true);
  });

  it.skip("each ratio is WCAG's to two decimals", () => {
    const row = contrastTable(tokens).find((r) => r.scheme === "light" && r.fg === "fg" && r.bg === "bg");
    expect(row?.ratio).toBe(round2(ratio("#111", "#fff")));
    const dark = contrastTable(tokens).find((r) => r.scheme === "dark" && r.fg === "fg" && r.bg === "bg");
    expect(dark?.ratio).toBe(round2(ratio("#eee", "#111")));
  });

  it.skip("for n color tokens it lists n(n-1) pairs per scheme, each ratio equal to the WCAG formula rounded (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: names.length }),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: names.length, maxLength: names.length }),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: names.length, maxLength: names.length }),
        (n, lights, darks) => {
          const used = names.slice(0, n);
          const color = Object.fromEntries(
            used.map((k, i) => [k, { light: hex(lights[i] ?? 0), dark: hex(darks[i] ?? 0) }]),
          );
          const rows = contrastTable(defineTokens({ color }));
          expect(rows).toHaveLength(n * (n - 1) * 2);
          for (const r of rows) {
            const i = used.findIndex((k) => k === r.fg);
            const j = used.findIndex((k) => k === r.bg);
            const pick = r.scheme === "light" ? lights : darks;
            expect(r.ratio).toBe(round2(ratio(hex(pick[i] ?? 0), hex(pick[j] ?? 0))));
          }
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it.skip("a single color token yields no entries", () => {
    expect(contrastTable(defineTokens({ color: { only: "#000" } }))).toEqual([]);
  });
});
