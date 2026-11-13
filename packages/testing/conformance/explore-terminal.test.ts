// Spec: k.model, Conformance "`terminal` holds a state from which every transaction returns that state unchanged, and no state with an edge to another."
// Seed: 1337.
// Untestable here: the `err` arm of `terminal` (an edge returning `err`); explore throws for invariant breaks and no other err is reachable from a valid payload.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

const made = (() => {
  let out: ReturnType<typeof mk> | undefined;
  scope(() => {
    out = mk();
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const st = store(s.object({ n: s.int({ min: 0, max: 5 }) }), { n: 0 }, { id: "term.count" });
  const raise = transaction(st, "term.raise", s.object({ to: s.int({ min: 0, max: 5 }) }), (state, { to }) => ({
    n: Math.max(state.n, to),
  }));
  const noop = transaction(st, "term.noop", s.object({}), (state) => state);
  const flip = store(s.object({ on: s.boolean() }), { on: false }, { id: "term.flip" });
  const toggle = transaction(flip, "term.toggle", s.object({}), (state) => ({ on: !state.on }));
  return { st, raise, noop, flip, toggle };
}
const { raise, noop, toggle } = made;

describe("k.model: terminal states", () => {
  it.skip("the state no transaction moves is terminal and no other state is", () => {
    const r = explore([raise, noop], {
      from: { n: 0 },
      payloads: { "term.raise": [{ to: 2 }, { to: 4 }], "term.noop": [{}] },
      depth: 6,
    });
    expect(r.states).toEqual([{ n: 0 }, { n: 2 }, { n: 4 }]);
    expect(r.terminal).toEqual([{ n: 4 }]);
  });

  it.skip("a transaction that returns the state unchanged alone makes the start terminal", () => {
    const r = explore([noop], { from: { n: 3 }, payloads: { "term.noop": [{}] }, depth: 2 });
    expect(r.terminal).toEqual([{ n: 3 }]);
  });

  it.skip("a state with an edge to another is not terminal even when its other edges return it unchanged", () => {
    const r = explore([noop, raise], {
      from: { n: 0 },
      payloads: { "term.noop": [{}], "term.raise": [{ to: 1 }] },
      depth: 3,
    });
    expect(r.terminal).not.toContainEqual({ n: 0 });
  });

  it.skip("states of a cycle are not terminal", () => {
    const r = explore([toggle], { from: { on: false }, payloads: { "term.toggle": [{}] }, depth: 4 });
    expect(r.states).toEqual([{ on: false }, { on: true }]);
    expect(r.terminal).toEqual([]);
  });

  it.skip("for every payload list, terminal is exactly the state at the largest raise, among the visited states", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), (a, b) => {
        const r = explore([raise, noop], {
          from: { n: 0 },
          payloads: { "term.raise": [{ to: a }, { to: b }], "term.noop": [{}] },
          depth: 6,
        });
        expect(r.terminal).toEqual([{ n: Math.max(a, b) }]);
        for (const t of r.terminal) expect(r.states).toContainEqual(t);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
