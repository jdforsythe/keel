// Spec: std.lists, clause "`move('next', false)` at the last option leaves it active; with `wrap` true the first becomes active."
// Seed: 1337. Assumptions in lists-support.ts.
import { listChart } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fruit, inScope } from "./lists-support.ts";

const chart = (n: number) => {
  const opts = fruit.slice(0, n);
  const { value } = inScope(() => listChart("w", "option", () => opts));
  return { list: value, opts };
};

describe("std.lists: move", () => {
  test("`move('next', false)` at the last option leaves it active", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
        const { list, opts } = chart(n);
        list.opened(n - 1);
        list.move("next", false);
        expect(list.activeOption()?.key).toBe(opts[n - 1]?.key);
        expect(list.index.get()).toBe(n - 1);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("with `wrap` true the first becomes active", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }), (n) => {
        const { list, opts } = chart(n);
        list.opened(n - 1);
        list.move("next", true);
        expect(list.activeOption()?.key).toBe(opts[0]?.key);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("`move` by `prev`, `first` and `last`, and `jump`, move the active option", () => {
    const { list } = chart(5);
    list.opened(2);
    list.move("prev", false);
    expect(list.index.get()).toBe(1);
    list.move("last", false);
    expect(list.index.get()).toBe(4);
    list.move("first", false);
    expect(list.index.get()).toBe(0);
    list.jump(3);
    expect(list.index.get()).toBe(3);
  });
});
