// Properties for the sim PRNG (xoshiro128** seeded via splitmix32). fast-check seed: 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { simRandom } from "../src/internal/simRandom.ts";
import { uuidFromWords } from "../src/internal/uuidFromWords.ts";
import { xoshiro128 } from "../src/internal/xoshiro128.ts";

const FC = { seed: 1337 };
const seedArb = fc.integer({ min: -(2 ** 31), max: 2 ** 32 - 1 });
const draw = (seed: number, n: number): number[] => {
  const next = xoshiro128(seed);
  return Array.from({ length: n }, () => next());
};

describe("xoshiro128", () => {
  test("pinned sequence for seed 1337 (replay compatibility across versions)", () => {
    expect(draw(1337, 4)).toEqual([1725742096, 2613034506, 4061506121, 1719555968]);
  });

  test("property: same seed, same sequence", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(draw(seed, 16)).toEqual(draw(seed, 16));
      }),
      FC,
    );
  });

  test("property: every output is a uint32", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const v of draw(seed, 32)) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(2 ** 32);
        }
      }),
      FC,
    );
  });

  test("property: distinct uint32 seeds give distinct first outputs (seeding is a bijection)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.integer({ min: 0, max: 2 ** 32 - 1 }), (a, b) => {
        fc.pre(a !== b);
        expect(draw(a, 1)).not.toEqual(draw(b, 1));
      }),
      FC,
    );
  });

  test("property: seed is coerced to uint32", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        expect(draw(seed - 2 ** 32, 4)).toEqual(draw(seed, 4));
      }),
      FC,
    );
  });
});

describe("simRandom", () => {
  test("property: float is in [0, 1) and id is a v4 uuid", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const r = simRandom(seed);
        for (let i = 0; i < 8; i++) {
          const f = r.float();
          expect(f >= 0 && f < 1).toBe(true);
          expect(r.id("X")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        }
      }),
      FC,
    );
  });

  test("property: uuidFromWords keeps every non-version, non-variant bit", () => {
    const u32 = fc.integer({ min: 0, max: 2 ** 32 - 1 });
    fc.assert(
      fc.property(u32, u32, u32, u32, (a, b, c, d) => {
        const hex = uuidFromWords(a, b, c, d).replaceAll("-", "");
        expect(Number.parseInt(hex.slice(0, 8), 16)).toBe(a);
        expect(Number.parseInt(hex.slice(8, 16), 16)).toBe(((b & 0xffff0fff) | 0x4000) >>> 0);
        expect(Number.parseInt(hex.slice(16, 24), 16)).toBe(((c & 0x3fffffff) | 0x80000000) >>> 0);
        expect(Number.parseInt(hex.slice(24), 16)).toBe(d);
      }),
      FC,
    );
  });
});
