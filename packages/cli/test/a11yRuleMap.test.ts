import { a11yRules, criteriaOf } from "@keel/testing/a11y";
import { WCAG_CRITERIA } from "@keel/testing/a11y";
// a11yRuleMap (k.a11y Claims): the render rules and static codes under each WCAG criterion, in WCAG order. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { a11yRuleMap } from "../src/internal/a11yRuleMap.ts";

const run = { seed: 1337, numRuns: 50 };
const map = a11yRuleMap();
const nums = (c: string): number[] => c.split(".").map(Number);
const sortedUnique = (xs: readonly string[]): boolean => xs.every((x, i) => i === 0 || (xs[i - 1] ?? "") < x);

describe("a11yRuleMap", () => {
  test("a11yRuleMap keys are criteria of WCAG 2.2 A and AA, in the standard's order", () => {
    const keys = [...map.keys()];
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) expect(WCAG_CRITERIA).toContain(k);
    expect(keys).toEqual(WCAG_CRITERIA.filter((c) => map.has(c)));
  });

  test("order is numeric, not textual: 1.4.4 comes before 1.4.12, and 2.x after 1.x", () => {
    const keys = [...map.keys()];
    expect(keys.indexOf("1.4.4")).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf("1.4.4")).toBeLessThan(keys.indexOf("1.4.12"));
    expect(keys.indexOf("1.3.1")).toBeLessThan(keys.indexOf("2.4.4"));
    for (let i = 1; i < keys.length; i++) {
      const [a, b] = [nums(keys[i - 1] ?? ""), nums(keys[i] ?? "")];
      const cmp = (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0);
      expect(cmp).toBeLessThan(0);
    }
  });

  test("the codes only keel check reports are static: E1802 under four criteria, E1820 under two, E1804 under 1.4.3", () => {
    for (const c of ["1.1.1", "1.3.1", "2.4.4", "4.1.2"]) expect(map.get(c)?.static).toContain("E1802");
    for (const c of ["1.3.2", "2.4.3"]) expect(map.get(c)?.static).toContain("E1820");
    expect(map.get("1.4.3")?.static).toEqual(["E1804"]);
    expect(map.get("1.3.2")?.static).toEqual(["E1820"]);
    expect(map.get("2.4.3")?.static).toEqual(["E1820"]);
    expect(map.get("1.3.5")?.static ?? []).toEqual([]);
  });

  test("E1804 also runs at render: it is a render rule of 1.4.3 as well", () => {
    expect(a11yRules()).toContain("E1804");
    expect(map.get("1.4.3")?.render).toContain("E1804");
  });

  test("each render rule is listed under exactly the criteria criteriaOf gives it", () => {
    for (const rule of a11yRules()) {
      const under = [...map.entries()].filter(([, v]) => v.render.includes(rule)).map(([c]) => c);
      expect(under.sort(), rule).toEqual([...criteriaOf(rule)].sort());
    }
  });

  test("a code that is not a static code is never in a static list", () => {
    const allowed = new Set(["E1802", "E1804", "E1820"]);
    for (const v of map.values()) for (const r of v.static) expect(allowed.has(r)).toBe(true);
  });

  test("property: every entry's render and static lists are sorted without duplicates, and an entry has at least one rule", () => {
    const entries = [...map.entries()];
    fc.assert(
      fc.property(fc.integer({ min: 0, max: entries.length - 1 }), (i) => {
        const [, v] = entries[i] ?? ["", { render: [], static: [] }];
        expect(sortedUnique(v.render)).toBe(true);
        expect(sortedUnique(v.static)).toBe(true);
        expect(v.render.length + v.static.length).toBeGreaterThan(0);
      }),
      run,
    );
  });

  test("two calls give equal maps", () => {
    expect([...a11yRuleMap().entries()]).toEqual([...map.entries()]);
  });
});
