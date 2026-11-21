// Spec: std.lists, Conformance "Under a sim ctx, `typeahead` of `b` then `a` within 500 ms makes the first option after the active one whose text starts `ba` active; a key 600 ms later starts a new buffer; `typeahead` of `ArrowDown` returns false."
// Seed: 1337. Assumptions in lists-support.ts. A `KeyInput` is `{ key, shift, alt, mod }` (k.aria).
import { listChart } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fruit, inScope, sim } from "./lists-support.ts";

const key = (k: string, mod = false) => ({ key: k, shift: false, alt: false, mod });
const make = () => {
  const ctx = sim();
  const { value } = inScope(() => listChart("w", "option", () => fruit, ctx));
  value.opened(0);
  return { list: value, ctx };
};

describe("std.lists: typeahead", () => {
  test("under a sim ctx, `b` then `a` within 500 ms makes the first option after the active one whose text starts `ba` active", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 499 }), (gap) => {
        const { list, ctx } = make();
        expect(list.typeahead(key("b"))).toBe(true);
        expect(list.activeOption()?.key).toBe("banana");
        ctx.clock.advance(gap);
        expect(list.typeahead(key("a"))).toBe(true);
        expect(list.activeOption()?.key).toBe("bacon");
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("a key 600 ms later starts a new buffer", () => {
    const { list, ctx } = make();
    list.typeahead(key("b"));
    list.typeahead(key("a"));
    ctx.clock.advance(600);
    expect(list.typeahead(key("c"))).toBe(true);
    expect(list.activeOption()?.key).toBe("cherry");
  });

  test("`typeahead` of `ArrowDown` returns false and moves nothing", () => {
    const { list } = make();
    expect(list.typeahead(key("ArrowDown"))).toBe(false);
    expect(list.activeOption()?.key).toBe("apple");
  });

  test("a printable key with `mod` is not taken", () => {
    const { list } = make();
    expect(list.typeahead(key("b", true))).toBe(false);
    expect(list.activeOption()?.key).toBe("apple");
  });

  test("without a ctx the buffer empties at each key, so `b` then `a` starts a new buffer at `a`", () => {
    const { value } = inScope(() => listChart("w", "option", () => fruit));
    value.opened(0);
    expect(value.typeahead(key("b"))).toBe(true);
    expect(value.activeOption()?.key).toBe("banana");
    expect(value.typeahead(key("c"))).toBe(true);
    expect(value.activeOption()?.key).toBe("cherry");
  });
});
