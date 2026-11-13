// Spec: k.model, Conformance "A transaction that breaks a declared invariant from a reachable state fails with E1708 whose `data.snapshot` log has the fewest entries of any path to it, and `restore` of that snapshot followed by `tx` of `data.transaction` with `data.payload` returns `store.invariant`."
// Seed: 1337.
// Spec: k.model, Rules "E1708 an invariant broke, or a transaction threw, on an explored edge"
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import { explore } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LIMIT = 6;

let seq = 0;
const build = () => {
  seq += 1;
  const id = `ce${seq}`;
  let out: ReturnType<typeof mk> | undefined;
  scope(() => {
    out = mk(id);
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
};
function mk(id: string) {
  const st = store(s.object({ n: s.int({ min: 0, max: 20 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n <= LIMIT);
  const step = transaction(st, `${id}.step`, s.object({ by: s.int({ min: 1, max: 3 }) }), (state, { by }) => ({
    n: state.n + by,
  }));
  const boom = transaction(st, `${id}.boom`, s.object({}), (state) => {
    if (state.n === 3) throw new Error("boom at 3");
    return state;
  });
  return { st, step, boom };
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
const dataOf = (e: unknown): Record<string, unknown> => {
  if (isRecord(e) && isRecord(e.data)) return e.data;
  throw new Error("fixture: thrown value has no data record");
};
const logOf = (snapshot: unknown): readonly unknown[] => {
  if (isRecord(snapshot) && Array.isArray(snapshot.log)) return snapshot.log;
  throw new Error("fixture: snapshot has no log");
};

// Fewest steps from `start` to a state with an edge that breaks the invariant, over a reference breadth-first search.
const fewest = (start: number, bys: readonly number[]): number => {
  const dist = new Map<number, number>([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i] ?? start;
    const d = dist.get(n) ?? 0;
    if (bys.some((by) => n + by > LIMIT)) return d;
    for (const by of bys) {
      if (!dist.has(n + by)) {
        dist.set(n + by, d + 1);
        queue.push(n + by);
      }
    }
  }
  throw new Error("fixture: no violating state");
};

describe("k.model: a broken invariant fails with E1708 and a shortest replayable counterexample", () => {
  it("a step that pushes n past the limit fails with E1708 naming the store, transaction, steps and states", () => {
    const { st, step } = build();
    const e = thrownSync(() => explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 3 }] }, depth: 10 }));
    expect(codeOf(e)).toBe("E1708");
    const message = isRecord(e) && typeof e.message === "string" ? e.message : "";
    expect(message).toMatch(
      new RegExp(`^explore ${st.id}: ${step.name} broke an invariant after \\d+ steps \\(\\d+ states\\)$`),
    );
  });

  it("data carries the start as snapshot.initial, the transaction name and the payload", () => {
    const { step } = build();
    const e = thrownSync(() => explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 3 }] }, depth: 10 }));
    const data = dataOf(e);
    expect(data.transaction).toBe(step.name);
    expect(data.payload).toEqual({ by: 3 });
    expect(isRecord(data.snapshot) ? data.snapshot.initial : undefined).toEqual({ n: 0 });
  });

  it("data.snapshot log is the fewest-entry path: two steps of 3 reach n 6, whose next step breaks the limit", () => {
    const { step } = build();
    const e = thrownSync(() => explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 3 }] }, depth: 10 }));
    expect(logOf(dataOf(e).snapshot)).toHaveLength(2);
  });

  it("restore of data.snapshot then tx of data.transaction with data.payload returns store.invariant", () => {
    const { st, step } = build();
    const e = thrownSync(() =>
      explore([step], { from: { n: 0 }, payloads: { [step.name]: [{ by: 2 }, { by: 3 }] }, depth: 10 }),
    );
    const data = dataOf(e);
    expect(st.restore(data.snapshot).ok).toBe(true);
    expect(data.transaction).toBe(step.name);
    const r = tx(step, data.payload);
    expect(r.ok).toBe(false);
    expect(r.ok ? undefined : r.error.code).toBe("store.invariant");
  });

  it("for every start and payload list, the snapshot log has the fewest entries of any path to a breaking edge", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: LIMIT }),
        fc.uniqueArray(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }),
        (start, bys) => {
          const { st, step } = build();
          const e = thrownSync(() =>
            explore([step], { from: { n: start }, payloads: { [step.name]: bys.map((by) => ({ by })) }, depth: 20 }),
          );
          expect(codeOf(e)).toBe("E1708");
          const data = dataOf(e);
          expect(logOf(data.snapshot)).toHaveLength(fewest(start, bys));
          expect(isRecord(data.snapshot) ? data.snapshot.initial : undefined).toEqual({ n: start });
          expect(st.restore(data.snapshot).ok).toBe(true);
          const r = tx(step, data.payload);
          expect(r.ok ? undefined : r.error.code).toBe("store.invariant");
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("a transaction whose function throws on an explored edge stops the run with E1708", () => {
    const { step, boom } = build();
    const e = thrownSync(() =>
      explore([step, boom], { from: { n: 0 }, payloads: { [step.name]: [{ by: 1 }], [boom.name]: [{}] }, depth: 5 }),
    );
    expect(codeOf(e)).toBe("E1708");
    expect(dataOf(e).transaction).toBe(boom.name);
    expect(logOf(dataOf(e).snapshot)).toHaveLength(3);
  });

  it("a run in which no edge breaks an invariant or throws does not fail with E1708", () => {
    const { step, boom } = build();
    const r = explore([step, boom], {
      from: { n: 0 },
      payloads: { [step.name]: [{ by: 1 }], [boom.name]: [{}] },
      depth: 2,
    });
    expect(r.states).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }]);
  });
});
