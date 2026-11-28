// Spec: k.model, clause "Two calls with equal arguments return equal results."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

const made = (() => {
  let out: ReturnType<typeof mk> | undefined;
  scope(
    () => {
      out = mk();
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const st = store(s.object({ n: s.int({ min: 0, max: 20 }) }), { n: 0 }, { id: "det.count" });
  invariant(st, (state) => state.n <= 6);
  const step = transaction(st, "det.step", s.object({ by: s.int({ min: 1, max: 3 }) }), (state, { by }) => ({
    n: state.n + by,
  }));
  const reset = transaction(st, "det.reset", s.object({}), () => ({ n: 0 }));
  return { st, step, reset };
}
const { step, reset } = made;

const thrownSync = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const parts = (e: unknown) => (isRecord(e) ? { code: e.code, message: e.message, data: e.data } : e);
// A run's outcome: its result, or the parts of what it threw.
const outcome = (run: () => unknown) => {
  const e = thrownSync(run);
  return e === undefined ? { result: run() } : { error: parts(e) };
};

describe("k.model: two calls with equal arguments return equal results", () => {
  it("two runs over generated starts and depths return equal results, or throw equal errors", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 5 }), (start, depth) => {
        const args = {
          from: { n: start },
          payloads: { "det.step": [{ by: 1 }], "det.reset": [{}] },
          depth,
        };
        const first = outcome(() => explore([step, reset], args));
        const second = outcome(() => explore([step, reset], { ...args }));
        expect(second).toEqual(first);
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("a run from the store's current state repeats exactly", () => {
    const first = explore([step, reset], { depth: 2, payloads: { "det.step": [{ by: 2 }], "det.reset": [{}] } });
    const second = explore([step, reset], { depth: 2, payloads: { "det.step": [{ by: 2 }], "det.reset": [{}] } });
    expect(second).toEqual(first);
  });

  it("two failing runs throw equal errors with equal data", () => {
    const run = () =>
      explore([step, reset], { from: { n: 0 }, payloads: { "det.step": [{ by: 3 }], "det.reset": [{}] }, depth: 5 });
    const a = thrownSync(run);
    const b = thrownSync(run);
    expect(a).toBeDefined();
    expect(parts(b)).toEqual(parts(a));
  });
});
