// Spec: k.model, clause "After `explore` returns or throws, the store's state, log and log `meta` equal those before the call."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import { explore } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

let seq = 0;
// A store with two committed entries carrying meta, so there is a log, with meta, to keep.
const build = () => {
  seq += 1;
  const id = `rs${seq}`;
  let out: ReturnType<typeof mk> | undefined;
  scope(() => {
    out = mk(id);
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  const { st, step } = out;
  if (!tx(step, { by: 1 }, { meta: { note: "first", n: 1 } }).ok) throw new Error("fixture: first commit failed");
  if (!tx(step, { by: 2 }, { meta: { note: "second", list: [1, 2] } }).ok)
    throw new Error("fixture: second commit failed");
  return out;
};
function mk(id: string) {
  const st = store(s.object({ n: s.int({ min: 0, max: 30 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n <= 9);
  const step = transaction(st, `${id}.step`, s.object({ by: s.int({ min: 1, max: 3 }) }), (state, { by }) => ({
    n: state.n + by,
  }));
  const reset = transaction(st, `${id}.reset`, s.object({}), () => ({ n: 0 }));
  return { st, step, reset };
}

const thrownSync = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);

describe("k.model: explore restores the store's state, log and log meta", () => {
  it("after explore returns, state, log and meta equal those before the call", () => {
    const { st, step, reset } = build();
    const before = st.snapshot({ meta: true });
    const log = st.log();
    const n = st.get("n");
    const r = explore([step, reset], {
      from: { n: 0 },
      payloads: { [step.name]: [{ by: 1 }], [reset.name]: [{}] },
      depth: 3,
    });
    expect(r.states.length).toBeGreaterThan(1);
    expect(st.get("n")).toBe(n);
    expect(st.log()).toEqual(log);
    expect(st.snapshot({ meta: true })).toEqual(before);
    expect(st.log().map((e) => e.meta)).toEqual([
      { note: "first", n: 1 },
      { note: "second", list: [1, 2] },
    ]);
  });

  it("after explore throws E1708, state, log and meta equal those before the call", () => {
    const { st, step } = build();
    const before = st.snapshot({ meta: true });
    const e = thrownSync(() => explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 3 }] }, depth: 10 }));
    expect(codeOf(e)).toBe("E1708");
    expect(st.snapshot({ meta: true })).toEqual(before);
    expect(st.log().map((x) => x.meta)).toEqual([
      { note: "first", n: 1 },
      { note: "second", list: [1, 2] },
    ]);
  });

  it("after explore throws E1709, state, log and meta equal those before the call", () => {
    const { st, step } = build();
    const before = st.snapshot({ meta: true });
    const e = thrownSync(() =>
      explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 1 }] }, depth: 8, maxStates: 3 }),
    );
    expect(codeOf(e)).toBe("E1709");
    expect(st.snapshot({ meta: true })).toEqual(before);
  });

  it("after explore throws E1710, state, log and meta equal those before the call", () => {
    const { st, step } = build();
    const before = st.snapshot({ meta: true });
    const e = thrownSync(() => explore([step], { from: { n: 99 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
    expect(st.snapshot({ meta: true })).toEqual(before);
  });

  it("for every start, payload list and depth, the store ends as it began, whether the run returns or throws", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 0, max: 6 }),
        (start, bys, depth) => {
          const { st, step, reset } = build();
          const before = st.snapshot({ meta: true });
          const state = st.get("n");
          thrownSync(() =>
            explore([step, reset], {
              from: { n: start },
              payloads: { [step.name]: bys.map((by) => ({ by })), [reset.name]: [{}] },
              depth,
            }),
          );
          expect(st.get("n")).toBe(state);
          expect(st.snapshot({ meta: true })).toEqual(before);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
