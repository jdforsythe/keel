// Spec: k.origins, Conformance "One key twice in `img` is one E1591 without types; one origin under `img` and `font` is none."
// Spec: k.origins, Rules "E1591 one origin twice in one directive (fix: delete the second entry)."
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, single, withCode } from "./origins-support.ts";

const e1591 = (origins: string) => withCode(single(origins), "E1591");

describe("k.origins: E1591", () => {
  test("one key twice in `img` is one E1591 without types", () => {
    const found = e1591("{ img: { 'https://a.example': 'one', 'https://a.example': 'two' } }");
    expect(found).toHaveLength(1);
  });
  test("the E1591 fix deletes the second entry and keeps the first", () => {
    const [d] = e1591("{ img: { 'https://a.example': 'one', 'https://a.example': 'two' } }");
    const lines = (d?.fix ?? "").split("\n");
    const rm = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1));
    const ad = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
    expect(rm).toHaveLength(1);
    expect(ad).toHaveLength(1);
    expect(rm[0]).toContain("'https://a.example': 'one', 'https://a.example': 'two'");
    expect(ad[0]).toBe((rm[0] ?? "").replace(", 'https://a.example': 'two'", ""));
  });
  test("one origin under `img` and `font` is none", () => {
    expect(e1591("{ img: { 'https://a.example': 'r' }, font: { 'https://a.example': 'r' } }")).toEqual([]);
  });
  test("two distinct origins in one directive are none", () => {
    expect(e1591("{ img: { 'https://a.example': 'r', 'https://b.example': 'r' } }")).toEqual([]);
  });
  test("a duplicate in any one of the five directives is one E1591, and an origin once in each is none", () => {
    const keys = ["img", "media", "font", "connect", "frame"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...keys), fc.stringMatching(/^[a-z]{3,10}$/), (k, h) => {
        const o = `https://${h}.example`;
        expect(e1591(`{ ${k}: { '${o}': 'x', '${o}': 'y' } }`)).toHaveLength(1);
        expect(e1591(`{ ${keys.map((key) => `${key}: { '${o}': 'x' }`).join(", ")} }`)).toEqual([]);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
