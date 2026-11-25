// Spec: k.sync, clause "A transaction declared without `concurrent` exposes `concurrent` `'reject'`."
// Seed 1337 (fast-check `seed: 1337`).
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inScope } from "./fixtures";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

describe("k.sync: concurrent default", () => {
  it("A transaction declared without `concurrent` exposes `concurrent` 'reject'", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}\.[a-z]{1,6}$/), (name) => {
        const t = inScope(() => {
          const bag = store(Bag, { items: [] });
          return transaction(bag, name, Push, (state, { v }) => ({ items: [...state.items, v] }));
        });
        expect(t.concurrent).toBe("reject");
      }),
      opts,
    );
  });

  it("a transaction declared with an empty options object exposes `concurrent` 'reject'", () => {
    const t = inScope(() => {
      const bag = store(Bag, { items: [] });
      return transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }), {});
    });
    expect(t.concurrent).toBe("reject");
  });

  it("a transaction declared with `concurrent` exposes that value", () => {
    for (const concurrent of ["reject", "rebase"] as const) {
      const t = inScope(() => {
        const bag = store(Bag, { items: [] });
        return transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }), {
          concurrent,
        });
      });
      expect(t.concurrent).toBe(concurrent);
    }
  });
});
