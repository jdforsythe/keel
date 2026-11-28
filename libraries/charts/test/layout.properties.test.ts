import fc from "fast-check";
import { expect, it } from "vitest";
import { barLayout } from "../src/barLayout.ts";
import { extent } from "../src/extent.ts";
import type { Frame } from "../src/Frame.ts";
import { fraction } from "../src/fraction.ts";
import { lineLayout } from "../src/lineLayout.ts";

const SEED = 20261125;
const frame: Frame = { width: 320, height: 180, left: 8, right: 8, top: 18, bottom: 22 };
// Finite numbers of every size: empty lists, one value, negatives, and values near Number.MAX_VALUE.
const values = fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), { maxLength: 40 });
// A case's bound is 300 ms for each of its runs (a few microseconds of layout here): 200 runs are 60 s.
const inside = (x: number, y: number) =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  x >= frame.left &&
  x <= frame.width - frame.right &&
  y >= frame.top &&
  y <= frame.height - frame.bottom;

it("every bar lies inside the plot area and rises from the zero line", { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(values, (vs) => {
      const { base, bars } = barLayout(vs, frame);
      expect(bars).toHaveLength(vs.length);
      expect(inside(frame.left, base)).toBe(true);
      bars.forEach((b, i) => {
        expect(inside(b.x, b.y)).toBe(true);
        expect(inside(b.x + b.width, b.y + b.height)).toBe(true);
        const v = vs[i] ?? 0;
        if (v > 0) expect(b.y + b.height).toBeCloseTo(base);
        if (v < 0) expect(b.y).toBeCloseTo(base);
      });
    }),
    { seed: SEED, numRuns: 200 },
  );
});

it("every line point lies inside the plot area, left to right in order", { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(values, (vs) => {
      const at = lineLayout(vs, frame);
      expect(at).toHaveLength(vs.length);
      at.forEach((p, i) => {
        expect(inside(p.x, p.y)).toBe(true);
        const before = at[i - 1];
        if (before !== undefined) expect(p.x).toBeGreaterThan(before.x);
      });
    }),
    { seed: SEED, numRuns: 200 },
  );
});

it("a higher value is never drawn lower", { timeout: 30_000 }, () => {
  fc.assert(
    fc.property(values, (vs) => {
      const at = lineLayout(vs, frame);
      vs.forEach((a, i) =>
        vs.forEach((b, j) => {
          const pa = at[i];
          const pb = at[j];
          if (pa !== undefined && pb !== undefined && a > b) expect(pa.y).toBeLessThanOrEqual(pb.y);
        }),
      );
    }),
    { seed: SEED, numRuns: 100 },
  );
});

it("fraction stays in [0, 1] and extent holds every value", { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(values, fc.boolean(), (vs, withZero) => {
      const { lo, hi } = extent(vs, withZero);
      if (withZero) expect(lo <= 0 && hi >= 0).toBe(true);
      for (const v of vs) {
        expect(lo <= v && v <= hi).toBe(true);
        const t = fraction(lo, hi, v);
        expect(t >= 0 && t <= 1).toBe(true);
      }
    }),
    { seed: SEED, numRuns: 200 },
  );
});

it("the extremes of the finite numbers give a finite span", () => {
  expect(fraction(-Number.MAX_VALUE, Number.MAX_VALUE, 0)).toBeCloseTo(0.5);
  expect(fraction(-Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE)).toBe(1);
  expect(fraction(3, 3, 3)).toBe(0.5);
  expect(extent([], false)).toEqual({ lo: 0, hi: 0 });
});
