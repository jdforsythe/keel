// Spec: k.prove, Conformance "A store `{ n: s.int({ min: 0 }) }` with invariant `n >= 0`, `inc` (`n + 1`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`."
// Spec: k.prove, Sorts "`s.int` as integers within its bounds, state and payload values also within ±(2^53 − 1)"
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;

let seq = 0;
/** Build a fixture inside a scope (E1203) under ids unique to this call. */
const build = <R>(mk: (id: string) => R): R => {
  seq += 1;
  const id = `pv${seq}`;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(id) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));
/** What the promise rejected with, or undefined when it resolved. */
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};
/** The JSON on the line after the first line of the message. */
const jsonLine = (e: unknown): unknown => {
  const line = messageOf(e).split("\n")[1];
  if (line === undefined) throw new Error("fixture: no line after the first line of the message");
  return JSON.parse(line);
};
/** Every value stored under `key` anywhere in `value`. */
const valuesAt = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((v) => valuesAt(v, key));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === key ? [v, ...valuesAt(v, key)] : valuesAt(v, key)));
};

const counter = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  const inc = transaction(st, `${id}.inc`, none, (state) => ({ n: state.n + 1 }));
  const dec = transaction(st, `${id}.dec`, none, (state) => ({ n: state.n > 0 ? state.n - 1 : state.n }));
  const bad = transaction(st, `${id}.bad`, none, (state) => ({ n: state.n - 1 }));
  return { inc, dec, bad };
};
// `n - by` for by = 1..4, each on its own store
const lower = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  return [
    transaction(st, `${id}.by1`, none, (state) => ({ n: state.n - 1 })),
    transaction(st, `${id}.by2`, none, (state) => ({ n: state.n - 2 })),
    transaction(st, `${id}.by3`, none, (state) => ({ n: state.n - 3 })),
    transaction(st, `${id}.by4`, none, (state) => ({ n: state.n - 4 })),
  ];
};

describe("k.prove: counter", () => {
  it(
    "a store { n: s.int({ min: 0 }) } with invariant n >= 0, inc and dec proves",
    async () => {
      const { inc, dec } = build(counter);
      expect(await rejection(() => prove([inc, dec]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "with dec as n - 1 the proof rejects E1716 with state { n: 0 }",
    async () => {
      const { inc, bad } = build(counter);
      const e = await rejection(() => prove([inc, bad]));
      expect(codeOf(e)).toBe("E1716");
      expect(valuesAt(jsonLine(e), "n")).toContain(0);
    },
    LONG,
  );

  it(
    "n - by rejects E1716 for every by in 1..4, and the state's n is below by",
    async () => {
      const txs = build(lower);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (i) => {
          const t = txs[i];
          if (t === undefined) throw new Error("fixture: no transaction");
          const e = await rejection(() => prove([t]));
          expect(codeOf(e)).toBe("E1716");
          const ns = valuesAt(jsonLine(e), "n").filter((v): v is number => typeof v === "number");
          expect(ns.length).toBeGreaterThan(0);
          expect(ns.some((n) => n >= 0 && n < i + 1)).toBe(true);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );
});

const MAX = 9007199254740991;
const bounded = (id: string) => {
  const none = s.object({ n: s.int() });
  const up = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.up` });
  invariant(up, (state) => state.n <= 9007199254740991);
  const upSet = transaction(up, `${id}.upSet`, none, (_state, p) => ({ n: p.n }));
  const upTight = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.upTight` });
  invariant(upTight, (state) => state.n <= 9007199254740990);
  const upTightSet = transaction(upTight, `${id}.upTightSet`, none, (_state, p) => ({ n: p.n }));
  const down = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.down` });
  invariant(down, (state) => state.n >= -9007199254740991);
  const downSet = transaction(down, `${id}.downSet`, none, (_state, p) => ({ n: p.n }));
  const downTight = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.downTight` });
  invariant(downTight, (state) => state.n >= -9007199254740990);
  const downTightSet = transaction(downTight, `${id}.downTightSet`, none, (_state, p) => ({ n: p.n }));
  const st = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.state` });
  invariant(st, (state) => state.n <= 9007199254740992);
  const jump = transaction(st, `${id}.jump`, s.object({}), (state) => ({ n: state.n === 9007199254740992 ? 18014398509481984 : state.n }));
  return { upSet, upTightSet, downSet, downTightSet, jump };
};

describe("k.prove: int sort bound", () => {
  it(
    "payload values of s.int are within ±(2^53 − 1): the bound proves and one inside it rejects with the extreme value",
    async () => {
      const f = build(bounded);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (positive) => {
          const [ok, tight] = positive ? [f.upSet, f.upTightSet] : [f.downSet, f.downTightSet];
          expect(await rejection(() => prove([ok]))).toBeUndefined();
          const e = await rejection(() => prove([tight]));
          expect(codeOf(e)).toBe("E1716");
          const ns = valuesAt(jsonLine(e), "n");
          expect(ns).toContain(positive ? MAX : -MAX);
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    LONG,
  );

  it(
    "state values of s.int are also within ±(2^53 − 1): a state at 2^53 is not considered",
    async () => {
      const { jump } = build(bounded);
      expect(await rejection(() => prove([jump]))).toBeUndefined();
    },
    LONG,
  );
});
