import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Spec: k.schema, clause "For number and int with bounds, every generated value is within bounds and parse rejects values outside with rule `min` or `max`."
// Seed 1337, 100 runs.
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const Num = s.number({ min: -2.5, max: 10 });
const Int = s.int({ min: 0, max: 1000 });
const OnlyMin = s.int({ min: 0 });
const OnlyMax = s.number({ max: 5 });

const rules = (r: ReturnType<typeof Int.parse>): string[] => (r.ok ? [] : r.error.data.issues.map((i) => i.rule));

describe("k.schema number and int bounds", () => {
  it("gen() stays within bounds", () => {
    fc.assert(
      fc.property(
        gen(Num),
        gen(Int),
        gen(OnlyMin),
        gen(OnlyMax),
        (a, b, c, d) =>
          a >= -2.5 && a <= 10 && Number.isInteger(b) && b >= 0 && b <= 1000 && Number.isInteger(c) && c >= 0 && d <= 5,
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("bounds are inclusive", () => {
    expect(Int.parse(0).ok).toBe(true);
    expect(Int.parse(1000).ok).toBe(true);
    expect(Num.parse(-2.5).ok).toBe(true);
    expect(Num.parse(10).ok).toBe(true);
  });
  it("parse rejects values below min with rule min", () => {
    expect(rules(Int.parse(-1))).toEqual(["min"]);
    expect(rules(Num.parse(-2.6))).toEqual(["min"]);
    expect(rules(OnlyMin.parse(-5))).toEqual(["min"]);
  });
  it("parse rejects values above max with rule max", () => {
    expect(rules(Int.parse(1001))).toEqual(["max"]);
    expect(rules(Num.parse(10.5))).toEqual(["max"]);
    expect(rules(OnlyMax.parse(6))).toEqual(["max"]);
  });
  it("parse rejects every sampled out-of-range integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (n) => {
        const inside = n >= 0 && n <= 1000;
        const got = rules(Int.parse(n));
        return inside ? got.length === 0 : got.length === 1 && got[0] === (n < 0 ? "min" : "max");
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("type, finite and int rules still come first", () => {
    expect(rules(Int.parse("5"))).toEqual(["type"]);
    expect(rules(Int.parse(1.5))).toEqual(["int"]);
    expect(rules(Num.parse(Number.POSITIVE_INFINITY))).toEqual(["finite"]);
  });
  it("decodeStrings coerces then checks bounds", () => {
    const O = s.object({ n: Int });
    expect(O.decodeStrings({ n: "5" }).ok).toBe(true);
    const bad = O.decodeStrings({ n: "5000" });
    expect(bad.ok).toBe(false);
    expect(bad.ok ? [] : bad.error.data.issues).toEqual([{ path: ["n"], rule: "max" }]);
  });
  it("doc() shows the bounds", () => {
    expect(Int.doc()).toContain("0..1000");
  });
  it("construction throws when min > max", () => {
    expect(() => s.number({ min: 2, max: 1 })).toThrow();
    expect(() => s.int({ min: 2, max: 1 })).toThrow();
    expect(() => s.int({ min: 1, max: 1 })).not.toThrow();
  });
});
