// Spec: k.model, Conformance "From `from`, with payload lists, `explore` visits exactly the states reachable within `depth` edges, each once and the start first, and `edges` counts one per expanded state, transaction and payload."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

const Count = s.object({ n: s.int({ min: 0, max: 9 }) });
const Pair = s.object({ a: s.int({ min: 0, max: 3 }), b: s.int({ min: 0, max: 3 }) });

const made = (() => {
  let out: ReturnType<typeof mk> | undefined;
  scope(() => {
    out = mk();
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const st = store(Count, { n: 0 }, { id: "reach.count" });
  const step = transaction(st, "reach.step", s.object({ by: s.int({ min: 1, max: 3 }) }), (state, { by }) => ({
    n: Math.min(9, state.n + by),
  }));
  const reset = transaction(st, "reach.reset", s.object({}), () => ({ n: 0 }));
  const pair = store(Pair, { a: 1, b: 2 }, { id: "reach.pair" });
  // returns the same state with its keys written in the other order
  const rebuild = transaction(pair, "reach.rebuild", s.object({}), (state) => ({ b: state.b, a: state.a }));
  return { st, step, reset, pair, rebuild };
}
const { step, reset, rebuild } = made;

// Reference breadth-first enumeration: expansion in discovery order, one edge per state, step payload and reset.
const model = (start: number, bys: readonly number[], depth: number) => {
  const seen: number[] = [start];
  let frontier: number[] = [start];
  let edges = 0;
  for (let d = 0; d < depth; d++) {
    const next: number[] = [];
    for (const n of frontier) {
      for (const succ of [...bys.map((by) => Math.min(9, n + by)), 0]) {
        edges++;
        if (!seen.includes(succ)) {
          seen.push(succ);
          next.push(succ);
        }
      }
    }
    frontier = next;
  }
  return { states: seen.map((n) => ({ n })), edges };
};

describe("k.model: explore visits exactly the states reachable within depth edges", () => {
  it("from n 0 with step by 1 and 2 and reset, depth 2: five states in visiting order, nine edges", () => {
    const r = explore([step, reset], {
      from: { n: 0 },
      payloads: { "reach.step": [{ by: 1 }, { by: 2 }], "reach.reset": [{}] },
      depth: 2,
    });
    expect(r.states).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]);
    expect(r.edges).toBe(9);
    expect(r.depth).toBe(2);
    expect(r.complete).toBe(false);
  });

  it("the start state is first and each state appears once", () => {
    const r = explore([step, reset], {
      from: { n: 4 },
      payloads: { "reach.step": [{ by: 1 }, { by: 2 }, { by: 3 }], "reach.reset": [{}] },
      depth: 4,
    });
    expect(r.states[0]).toEqual({ n: 4 });
    const keys = r.states.map((x) => JSON.stringify(x));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a space exhausted inside depth is complete and every state is expanded", () => {
    const r = explore([step, reset], {
      from: { n: 8 },
      payloads: { "reach.step": [{ by: 1 }], "reach.reset": [{}] },
      depth: 20,
    });
    expect(r.states.map((x) => x.n)).toEqual([8, 9, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(r.complete).toBe(true);
    expect(r.edges).toBe(10 * 2);
  });

  it("states and edges equal a reference breadth-first enumeration for every start, payload list and depth", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 0, max: 5 }),
        (start, bys, depth) => {
          const r = explore([step, reset], {
            from: { n: start },
            payloads: { "reach.step": bys.map((by) => ({ by })), "reach.reset": [{}] },
            depth,
          });
          const want = model(start, bys, depth);
          expect(r.states).toEqual(want.states);
          expect(r.edges).toBe(want.edges);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a state is one with another when their JSON encodings with sorted keys are equal", () => {
    const r = explore([rebuild], { from: { a: 1, b: 2 }, payloads: { "reach.rebuild": [{}] }, depth: 3 });
    expect(r.states).toHaveLength(1);
    expect(r.edges).toBe(1);
    expect(r.complete).toBe(true);
  });
});
