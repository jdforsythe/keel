import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { invariant, store, transaction } from "../src/index.ts";
import { sourcesOf } from "../src/internal/index.ts";

const kit = (id: string) => {
  const st = store(s.object({ n: s.int() }), { n: 0 }, { id });
  const fn = (state: { n: number }, p: { by: number }) => ({ n: state.n + p.by });
  return { st, fn, add: transaction(st, "src.add", s.object({ by: s.int() }), fn) };
};

describe("sourcesOf (@keel/store/internal)", () => {
  it("returns the declared function and the store's invariants in order, copied at call time", () => {
    scope(() => {
      const { st, fn, add } = kit("src.a");
      const first = (x: { n: number }) => x.n >= 0;
      invariant(st, first);
      const got = sourcesOf(add);
      expect(got?.fn).toBe(fn);
      expect(got?.invariants).toEqual([first]);
      const second = (x: { n: number }) => x.n < 10;
      invariant(st, second);
      expect(got?.invariants).toEqual([first]);
      expect(sourcesOf(add)?.invariants).toEqual([first, second]);
      expect(got?.fn({ n: 1 }, { by: 2 })).toEqual({ n: 3 });
    });
  });

  it("is undefined for an object that is not a declared transaction", () => {
    scope(() => {
      const { add } = kit("src.b");
      expect(sourcesOf({ ...add })).toBeUndefined();
    });
  });
});
