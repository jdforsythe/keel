// k.sync Write key: the window of remembered keys equals a naive model (push, shift when over the limit) under any
// sequence of keyed writes and restores, and the held count per pair stays in step with it.
// Seed: 1337 (opts in kit.ts).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { keyWindow } from "../src/internal/keyWindow.ts";
import { opts } from "./kit.ts";

type Pair = { name: string; key: string };
type Step = { kind: "add"; pair: Pair } | { kind: "reset"; pairs: Pair[] };

const pairArb: fc.Arbitrary<Pair> = fc.record({
  name: fc.constantFrom("a.x", "b.y"),
  key: fc.constantFrom("k0", "k1", "k2", "k3", "k4", "k5"),
});
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  { arbitrary: pairArb.map((pair): Step => ({ kind: "add", pair })), weight: 8 },
  { arbitrary: fc.array(pairArb, { maxLength: 12 }).map((pairs): Step => ({ kind: "reset", pairs })), weight: 1 },
);

describe("keyWindow against a naive model", () => {
  it("lists, holds and evicts as push-and-shift does, at limits 0 to 6", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.array(stepArb, { maxLength: 400 }), (limit, steps) => {
        const w = keyWindow(limit);
        let model: Pair[] = [];
        for (const st of steps) {
          if (st.kind === "add") {
            w.add(st.pair);
            model.push({ ...st.pair });
            if (model.length > limit) model.shift();
          } else {
            w.reset(st.pairs);
            model = st.pairs.slice(-limit).map((p) => ({ ...p }));
            if (limit === 0) model = [];
          }
          expect(w.list()).toEqual(model);
        }
        for (const name of ["a.x", "b.y"])
          for (const key of ["k0", "k1", "k2", "k3", "k4", "k5"])
            expect(w.has({ name, key })).toBe(model.some((p) => p.name === name && p.key === key));
      }),
      opts,
    );
  });

  it("stays in step across compaction: 300 adds under limit 70", () => {
    const w = keyWindow(70);
    const model: Pair[] = [];
    for (let i = 0; i < 300; i++) {
      const p = { name: "a.x", key: `k${i % 97}` };
      w.add(p);
      model.push(p);
      if (model.length > 70) model.shift();
      expect(w.list()).toEqual(model);
    }
  });
});
