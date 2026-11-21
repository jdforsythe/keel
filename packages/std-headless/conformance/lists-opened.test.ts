// Spec: std.lists, Conformance "`opened(2)` on a closed list of five makes `index.get()` 2 and `open.get()` true; `opened(5)` makes `index.get()` -1; `opened(0)` on an open list leaves `index.get()` as it was."
// Spec: std.lists, listChart "`opened(at)` opens a closed list with option `at` active, and none active when `at` is -1 or not below the list's length; on an open list it does nothing."
// Seed: 1337. Assumptions in lists-support.ts.
import { listChart } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fruit, inScope } from "./lists-support.ts";

const chart = () => inScope(() => listChart("w", "option", () => fruit)).value;

describe("std.lists: opened(at)", () => {
  test("`opened(2)` on a closed list of five makes `index.get()` 2 and `open.get()` true", () => {
    const l = chart();
    expect(l.open.get()).toBe(false);
    l.opened(2);
    expect(l.index.get()).toBe(2);
    expect(l.open.get()).toBe(true);
  });

  test("`opened(5)` on a list of five makes `index.get()` -1", () => {
    const l = chart();
    l.opened(5);
    expect(l.index.get()).toBe(-1);
    expect(l.open.get()).toBe(true);
    expect(l.activeId.get()).toBe("");
  });

  test("`opened(-1)` opens with no option active", () => {
    const l = chart();
    l.opened(-1);
    expect(l.index.get()).toBe(-1);
    expect(l.open.get()).toBe(true);
  });

  test("`opened(0)` on an open list leaves `index.get()` as it was", () => {
    const l = chart();
    l.opened(3);
    l.opened(0);
    expect(l.index.get()).toBe(3);
    expect(l.open.get()).toBe(true);
  });

  test("property: on a closed list `opened(at)` makes `at` active when 0 <= at < length, else none", () => {
    fc.assert(
      fc.property(fc.integer({ min: -3, max: 9 }), (at) => {
        const l = chart();
        l.opened(at);
        expect(l.index.get()).toBe(at >= 0 && at < fruit.length ? at : -1);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("property: on an open list `opened(at)` changes nothing", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), fc.integer({ min: -3, max: 9 }), (first, at) => {
        const l = chart();
        l.opened(first);
        l.opened(at);
        expect(l.index.get()).toBe(first);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
